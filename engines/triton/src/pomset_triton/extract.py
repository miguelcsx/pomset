"""Resolve source bindings into address/mask ASTs without executing Python."""

from __future__ import annotations

import ast
from copy import deepcopy
from dataclasses import dataclass, field

from .parse import Entrypoint, Unsupported


def unsupported(node: ast.AST, construct: str) -> Unsupported:
    return Unsupported(
        construct, getattr(node, "lineno", 1), getattr(node, "col_offset", 0)
    )


def builtin(node: ast.AST) -> str | None:
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        if isinstance(node.func.value, ast.Name) and node.func.value.id == "tl":
            return node.func.attr
    return None


def resolve(node: ast.expr, bindings: dict[str, ast.expr]) -> ast.expr:
    class Bindings(ast.NodeTransformer):
        def visit_Name(self, name: ast.Name) -> ast.expr:
            return deepcopy(bindings.get(name.id, name))

    return Bindings().visit(deepcopy(node))


@dataclass(frozen=True)
class Access:
    kind: str
    pointer: str
    lane_expression: str
    mask_expression: str | None
    line: int
    column: int
    path: str
    offset: ast.expr
    mask: ast.expr
    end_line: int
    end_column: int

    @property
    def source_range(self) -> dict:
        return {
            "path": self.path,
            "startLine": self.line,
            "startColumn": self.column,
            "endLine": self.end_line,
            "endColumn": self.end_column,
            "kind": "source",
            "confidence": "exact",
        }


@dataclass
class Extraction:
    entrypoint: Entrypoint
    program_ids: tuple[str, ...]
    block_size: str | None
    index_bound: str | None
    accesses: tuple[Access, ...]
    notes: list[str] = field(default_factory=list)

    @property
    def stores(self) -> tuple[Access, ...]:
        return tuple(access for access in self.accesses if access.kind == "store")


def _access(kind: str, call: ast.Call, bindings: dict, entry: Entrypoint) -> Access:
    if len(call.args) != (1 if kind == "load" else 2):
        raise unsupported(call, f"tl.{kind} argument count")
    allowed = {"mask", "other"} if kind == "load" else {"mask"}
    names = [keyword.arg for keyword in call.keywords]
    if len(set(names)) != len(names) or any(name not in allowed for name in names):
        raise unsupported(call, f"tl.{kind} keyword arguments")
    pointer_expr = resolve(call.args[0], bindings)
    if not isinstance(pointer_expr, ast.BinOp) or not isinstance(
        pointer_expr.op, ast.Add
    ):
        raise unsupported(call, "pointer expression must be named allocation + offset")
    pointer = pointer_expr.left
    if not isinstance(pointer, ast.Name) or pointer.id not in entry.parameters:
        raise unsupported(call, "pointer is not a declared argument")
    mask_node = next(
        (kw.value for kw in call.keywords if kw.arg == "mask"), ast.Constant(True)
    )
    mask = resolve(mask_node, bindings)
    offset = pointer_expr.right
    return Access(
        kind,
        pointer.id,
        ast.unparse(offset),
        ast.unparse(mask),
        call.lineno,
        call.col_offset,
        entry.path,
        offset,
        mask,
        call.end_lineno or call.lineno,
        call.end_col_offset or call.col_offset,
    )


def extract(entrypoint: Entrypoint) -> Extraction:
    bindings: dict[str, ast.expr] = {}
    accesses = []
    program_ids = []
    blocks = []
    for statement in entrypoint.node.body:
        if (
            isinstance(statement, ast.Expr)
            and isinstance(statement.value, ast.Constant)
            and isinstance(statement.value.value, str)
        ):
            continue
        if isinstance(statement, ast.Assign):
            if len(statement.targets) != 1 or not isinstance(
                statement.targets[0], ast.Name
            ):
                raise unsupported(statement, "multiple or non-name assignment")
            value = statement.value
        elif isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
            value = statement.value
        elif isinstance(statement, ast.Pass):
            continue
        elif isinstance(statement, ast.Return) and statement.value is None:
            break
        else:
            raise unsupported(statement, type(statement).__name__.lower())
        for node in ast.walk(value):
            if not isinstance(node, ast.Call):
                continue
            name = builtin(node)
            if name not in {"program_id", "arange", "load", "store"}:
                raise unsupported(node, ast.unparse(node.func))
            if name in {"load", "store"}:
                accesses.append(_access(name, node, bindings, entrypoint))
            if name == "program_id":
                if (
                    len(node.args) != 1
                    or not isinstance(node.args[0], ast.Constant)
                    or node.args[0].value != 0
                    or node.keywords
                ):
                    raise unsupported(node, "only program_id(0) is modeled")
                program_ids.append(ast.unparse(node))
            if name == "arange":
                if (
                    len(node.args) != 2
                    or not isinstance(node.args[0], ast.Constant)
                    or node.args[0].value != 0
                    or node.keywords
                ):
                    raise unsupported(node, "only arange(0, bound) is modeled")
                blocks.append(ast.unparse(node.args[1]))
        if isinstance(statement, ast.Assign):
            bindings[statement.targets[0].id] = resolve(value, bindings)
    if len(set(blocks)) > 1:
        raise unsupported(entrypoint.node, "multiple lane shapes")
    return Extraction(
        entrypoint,
        tuple(program_ids),
        blocks[0] if blocks else None,
        None,
        tuple(accesses),
        ["Values are uninterpreted; no numerical claim follows."],
    )

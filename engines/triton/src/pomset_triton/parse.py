"""Parse a kernel module as source text and index its entrypoint.

The symbolic path reads the module with :mod:`ast` and never imports, execs or
runs it: reading a kernel and executing it are different acts with different
trust boundaries. The supported subset is deliberately tiny, and anything
outside it is refused with the construct named rather than approximated.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

from pomset_contracts.engine_protocol import InputInvalid, Unsupported

# The two refusals are the protocol's, not this module's: every engine reports a
# construct it cannot model the same way. They are re-exported here because this
# is where the rest of the package has always imported them from.
__all__ = [
    "Entrypoint",
    "InputInvalid",
    "Unsupported",
    "load_entrypoint",
    "select_entrypoint",
]


@dataclass(frozen=True)
class Entrypoint:
    """One explicit `@triton.jit` entrypoint, with its source range."""

    symbol: str
    path: str
    source: str
    node: ast.FunctionDef
    parameters: tuple[str, ...]
    constexpr_parameters: tuple[str, ...]


def _is_jit_decorator(decorator: ast.expr) -> bool:
    target = decorator.func if isinstance(decorator, ast.Call) else decorator
    return (
        isinstance(target, ast.Attribute)
        and target.attr == "jit"
        and isinstance(target.value, ast.Name)
        and target.value.id == "triton"
    )


def parse_module(source: str, path: str) -> ast.Module:
    try:
        return ast.parse(source, filename=path)
    except SyntaxError as error:
        raise InputInvalid(f"{path} is not parsable: {error.msg}") from error


def select_entrypoint(source: str, path: str, symbol: str) -> Entrypoint:
    """Selects exactly the named entrypoint, or refuses the selection.

    A missing symbol, a differently decorated function, a duplicated symbol or a
    plain function all produce an explicit error. The first decorated function is
    never substituted for the requested one.
    """
    module = parse_module(source, path)
    decorated = [
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef)
        and any(_is_jit_decorator(d) for d in node.decorator_list)
    ]

    if not decorated:
        raise InputInvalid(f"{path} declares no @triton.jit function")

    matching = [node for node in decorated if node.name == symbol]
    if not matching:
        raise InputInvalid(
            f"{path} declares no @triton.jit function named {symbol} "
            f"(it declares {', '.join(node.name for node in decorated)})"
        )
    if (
        sum(
            isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            and item.name == symbol
            for item in module.body
        )
        > 1
    ):
        raise InputInvalid(f"{path} declares {symbol} more than once")

    node = matching[0]
    if (
        node.args.posonlyargs
        or node.args.kwonlyargs
        or node.args.vararg
        or node.args.kwarg
        or node.args.defaults
    ):
        raise Unsupported(
            "entrypoint parameter kinds or defaults", node.lineno, node.col_offset
        )
    if len(node.decorator_list) != 1 or isinstance(node.decorator_list[0], ast.Call):
        raise Unsupported(
            "entrypoint decorators or decorator options", node.lineno, node.col_offset
        )
    for argument in node.args.args:
        annotation = argument.annotation
        if annotation is not None and not (
            isinstance(annotation, ast.Attribute)
            and isinstance(annotation.value, ast.Name)
            and annotation.value.id == "tl"
            and annotation.attr == "constexpr"
        ):
            raise Unsupported(
                "parameter annotation", argument.lineno, argument.col_offset
            )
    constexpr = [
        argument.arg
        for argument in node.args.args
        if isinstance(argument.annotation, ast.Attribute)
        and argument.annotation.attr == "constexpr"
    ]
    return Entrypoint(
        symbol=symbol,
        path=path,
        source=source,
        node=node,
        parameters=tuple(argument.arg for argument in node.args.args),
        constexpr_parameters=tuple(constexpr),
    )


def load_entrypoint(path: Path, symbol: str) -> Entrypoint:
    return select_entrypoint(path.read_text(encoding="utf-8"), str(path), symbol)

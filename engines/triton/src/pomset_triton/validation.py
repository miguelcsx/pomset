"""Validate records against the same canonical schemas as TypeScript."""

from functools import lru_cache
import math
from pomset_contracts.check import load_registry, validator_for
from .parse import InputInvalid


@lru_cache
def validator(target: str):
    registry, schemas = load_registry()
    return validator_for(schemas, registry, target)


def validate(value: object, target: str) -> None:
    def portable(node, path=""):
        if type(node) is int and abs(node) > (1 << 53) - 1:
            raise InputInvalid(
                f"{path}: integer outside interoperable JSON range; decimal encoding required"
            )
        if type(node) is float and not math.isfinite(node):
            raise InputInvalid(f"{path}: non-finite JSON number")
        if isinstance(node, dict):
            for key, item in node.items():
                portable(item, f"{path}/{key}")
        elif isinstance(node, list):
            for index, item in enumerate(node):
                portable(item, f"{path}/{index}")

    portable(value)
    errors = list(validator(target).iter_errors(value))
    if errors:
        first = errors[0]
        pointer = "/" + "/".join(str(part) for part in first.absolute_path)
        raise InputInvalid(f"{pointer}: {first.message}")

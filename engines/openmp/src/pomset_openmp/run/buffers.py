"""Fresh, poisoned buffers, and the input pattern both sides agree on.

A comparison against residue from a previous run would accept an output that was
never written, because an uninitialised buffer usually holds something
plausible. Every run therefore gets buffers it has never seen: inputs filled from
the harness's own pattern, and outputs poisoned with a value no correct
computation produces.

The pattern lives here and is emitted both as C and as Python. A reference that
disagreed with the kernel about its inputs would report a defect that belongs to
the harness, not to the kernel.

The poison is the value the *declared width* can hold, not the Python number that
names it: `float32(-1e30)` and the double `-1e30` are different numbers, and
comparing across the two would call an element no store reached "written with
something else" — the precise confusion poisoning exists to prevent.
"""

from __future__ import annotations

import struct

# A scenario may not ask the harness for an unbounded amount of memory.
MAX_ELEMENTS = 1 << 22

# The dtypes this harness can drive. The rest are refused by name rather than
# approximated: a kernel whose elements cannot be read back exactly cannot be
# compared against anything.
TYPES: dict[str, dict[str, str | float | int]] = {
    "fp32": {
        "c": "float",
        "printf": "%a",
        "kind": "float",
        "poison": -1.0e30,
    },
    "fp64": {
        "c": "double",
        "printf": "%a",
        "kind": "float",
        "poison": -1.0e30,
    },
    "int32": {"c": "int", "printf": "%d", "kind": "int", "poison": -2000000000},
    "int64": {
        "c": "long long",
        "printf": "%lld",
        "kind": "int",
        "poison": -4000000000000000000,
    },
    "uint32": {
        "c": "unsigned int",
        "printf": "%u",
        "kind": "int",
        "poison": 4000000000,
    },
}


def _narrow(dtype: str, value: float) -> float:
    """Rounds a poison to the width the kernel will store it in."""
    if dtype == "fp32":
        return struct.unpack("f", struct.pack("f", value))[0]
    return value


def poison(dtype: str) -> float | int:
    entry = TYPES[dtype]
    value = entry["poison"]
    return _narrow(dtype, float(value)) if entry["kind"] == "float" else int(value)


def poison_literal(dtype: str) -> str:
    """The poison as a C literal, exactly representable in that width."""
    entry = TYPES[dtype]
    value = poison(dtype)
    if entry["kind"] == "float":
        return f"{value!r}{'f' if dtype == 'fp32' else ''}"
    return str(value)


def input_value(dtype: str, index: int) -> float | int:
    """Element `index` of an input buffer. Defined once, emitted twice."""
    pattern = (index % 17) - 8
    if TYPES[dtype]["kind"] == "float":
        return pattern * 0.5
    return pattern


def input_expression(dtype: str, index: str) -> str:
    """The same value, as a C expression over an index variable."""
    entry = TYPES[dtype]
    name = entry["c"]
    if entry["kind"] == "float":
        suffix = "f" if dtype == "fp32" else ""
        return f"(({name})((({index} % 17) - 8) * 0.5{suffix}))"
    return f"(({name})(({index} % 17) - 8))"


def parse_dump(dtype: str, text: str) -> list[float]:
    """Reads back what the driver printed, at the width it was stored in."""
    values: list[float] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if TYPES[dtype]["kind"] == "float":
            values.append(float.fromhex(line))
        else:
            values.append(float(int(line)))
    return values

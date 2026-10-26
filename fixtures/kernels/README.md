# Kernel fixtures

A fixture is a tiny kernel with a **declared outcome**, so that a check can be
judged against something other than itself. Every directory holds a
`fixture.json` recording where the kernel came from, the licence it is used
under, and what the analysis is expected to find. A fixture without provenance,
or without a declared outcome, is not admitted.

```json
{
  "fixtureId": "fx_triton_transform_floor_grid",
  "class": "defect",
  "backend": "triton",
  "entrypoint": "kernel.py",
  "symbol": "transform",
  "origin": "reconstructed",
  "reconstructs": "https://github.com/triton-lang/triton/issues/9230",
  "licence": "Apache-2.0",
  "revision": "pomset@0.0.0",
  "expectedOutcome": {
    "property": "outputCoverage",
    "outcome": "violated",
    "qualifier": "for a floor-divided grid whose remainder is non-zero"
  }
}
```

`class` is `defect` or `control`. Every defect ships with a **correct control** —
the same kernel with the defect removed — because a check that fires on a defect
and stays silent on the control is the only kind of evidence this product
publishes. A clean run on a control is coverage of that run, never a proof of
race freedom.

`origin` is one of:

| Origin | Meaning |
|---|---|
| `upstream` | A reproducer obtained upstream, redistributed under its licence. |
| `reconstructed` | A minimal fixture written here that demonstrates the same mechanism as the upstream case it names. It is never labelled the upstream reproducer. |
| `original` | Written for this repository. |

`licence` is the licence the fixture is redistributed under. A fixture that is
not Pomset's own work must also be named in the repository [`NOTICE`](../NOTICE)
with its origin, revision and licence text; `check:licences` enforces both.

Licence: Pomset is Apache-2.0. Selective reuse of Compiler Explorer keeps its
BSD-2-Clause notices; see [`docs/reference/compiler-explorer.md`](../docs/reference/compiler-explorer.md).

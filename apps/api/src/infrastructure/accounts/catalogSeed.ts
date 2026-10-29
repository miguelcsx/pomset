/**
 * The catalog entries every database starts with: the Triton output-coverage
 * defect and its control, from `fixtures/kernels/triton`. The kernel text is
 * copied from those fixtures and `catalog-seed.test.ts` fails if they drift.
 *
 * Inserted with skip-duplicates on every start, so an administrator's edit to
 * a seeded entry survives a restart; the seed only fills in what is missing.
 */

import type { CatalogItemInput } from "../../domain/catalog/CatalogItem.js";

export interface CatalogSeedItem extends CatalogItemInput {
  readonly id: string;
}

export const CATALOG_SEED: readonly CatalogSeedItem[] = [
  {
    id: "cat_triton_transform_floor_grid",
    title: "Triton transform: floor-divided grid",
    summary:
      "A kernel that never writes the last N mod BLOCK outputs when the grid is floor-divided. Reconstructed from a public report; it is not the upstream reproducer.",
    kind: "defect",
    source: `"""The flagship output-coverage fixture, in the supported Triton subset.

One explicit \`\`@triton.jit\`\` entrypoint, named pointer and \`\`constexpr\`\`
parameters, \`\`tl.program_id\`\`, a constant-bounded \`\`tl.arange\`\`, integer address
arithmetic, a boolean mask, and \`\`tl.load\`\`/\`\`tl.store\`\` with address and mask.
Nothing here is outside the modelled subset, so the extractor can reason about it
symbolically without executing anything.

The declared outcome is a property of the *scenario*, not of this file: with
\`\`grid = (N // BLOCK,)\`\` and a remainder, the final block's lanes are all masked
off and the output is never written. With \`\`grid = (ceil(N / BLOCK),)\`\` — the
control — every declared output element is written.
"""

import triton
import triton.language as tl


@triton.jit
def transform(X, Y, N, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offsets = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offsets < N
    x = tl.load(X + offsets, mask=mask)
    tl.store(Y + offsets, x * 2.0, mask=mask)
`,
    scenario: {
  "schemaVersion": 1,
  "scenarioId": "scn_catalog_floor_grid",
  "snapshotId": "snp_catalog_floor_grid",
  "name": "transform output coverage, floor-divided grid",
  "entrypoint": {
    "path": "kernel.py",
    "symbol": "transform"
  },
  "allocations": [
    {
      "allocationId": "al_x",
      "name": "X",
      "role": "input",
      "dtype": "fp16",
      "shape": [
        {
          "op": "parameter",
          "parameter": "N"
        }
      ]
    },
    {
      "allocationId": "al_y",
      "name": "Y",
      "role": "output",
      "dtype": "fp16",
      "shape": [
        {
          "op": "parameter",
          "parameter": "N"
        }
      ],
      "poisoned": true
    }
  ],
  "launch": {
    "grid": [
      {
        "op": "floorDivide",
        "operands": [
          {
            "op": "parameter",
            "parameter": "N"
          },
          {
            "op": "parameter",
            "parameter": "BLOCK"
          }
        ]
      }
    ],
    "block": [
      {
        "op": "parameter",
        "parameter": "BLOCK"
      }
    ],
    "numWarps": {
      "op": "literal",
      "value": 4
    },
    "displayHints": [
      "grid = (N // BLOCK,)"
    ]
  },
  "domain": {
    "domainId": "dom_catalog_floor_grid",
    "enumerable": true,
    "variables": [
      {
        "name": "N",
        "kind": "shape",
        "type": "int",
        "width": "i32",
        "min": 1,
        "max": 4096,
        "step": 1
      },
      {
        "name": "BLOCK",
        "kind": "blockSize",
        "type": "enum",
        "values": [
          128,
          256,
          512
        ]
      },
      {
        "name": "dtype",
        "kind": "dtype",
        "type": "enum",
        "values": [
          "fp16",
          "bf16"
        ]
      }
    ],
    "constraints": [
      {
        "constraintId": "c_1",
        "lhs": {
          "op": "parameter",
          "parameter": "N"
        },
        "relation": "ge",
        "rhs": {
          "op": "literal",
          "value": 1
        }
      },
      {
        "constraintId": "c_2",
        "lhs": {
          "op": "parameter",
          "parameter": "BLOCK"
        },
        "relation": "gt",
        "rhs": {
          "op": "literal",
          "value": 0
        }
      }
    ],
    "hardwareCohortIds": [
      "hw_a100_80g"
    ]
  },
  "requiredProperties": [
    "outputCoverage",
    "memoryBounds",
    "writeWriteConflict"
  ],
  "notes": "The defective launch: a floor-divided grid never launches the final partial block, so the last N mod BLOCK output elements are never written.",
  "createdAt": "2026-10-12T09:18:00Z"
},
    expectedOutcome:
      "outputCoverage is violated for a floor-divided grid whose remainder is non-zero, and holds when N is a multiple of BLOCK.",
  },
  {
    id: "cat_triton_transform_ceil_grid",
    title: "Triton transform: ceiling-divided grid",
    summary:
      "The same kernel launched with ceil(N / BLOCK) blocks. Every declared output is written, so the check should stay quiet.",
    kind: "control",
    source: `"""The correct control for the floor-grid fixture.

The same kernel as \`\`../transform_floor_grid/kernel.py\`\`. The defect is removed by
the scenario, not by the source: the grid is \`\`ceilDivide(N, BLOCK)\`\`, so the
final block is launched and its in-range lanes write. A check that fires on the
defect and stays silent here is the only kind of evidence this product publishes;
a clean run is coverage of that run and is never presented as a proof.
"""

import triton
import triton.language as tl


@triton.jit
def transform(X, Y, N, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offsets = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offsets < N
    x = tl.load(X + offsets, mask=mask)
    tl.store(Y + offsets, x * 2.0, mask=mask)
`,
    scenario: {
  "schemaVersion": 1,
  "scenarioId": "scn_catalog_ceil_grid",
  "snapshotId": "snp_catalog_ceil_grid",
  "name": "transform output coverage, ceiling-divided grid",
  "entrypoint": {
    "path": "kernel.py",
    "symbol": "transform"
  },
  "allocations": [
    {
      "allocationId": "al_x",
      "name": "X",
      "role": "input",
      "dtype": "fp16",
      "shape": [
        {
          "op": "parameter",
          "parameter": "N"
        }
      ]
    },
    {
      "allocationId": "al_y",
      "name": "Y",
      "role": "output",
      "dtype": "fp16",
      "shape": [
        {
          "op": "parameter",
          "parameter": "N"
        }
      ],
      "poisoned": true
    }
  ],
  "launch": {
    "grid": [
      {
        "op": "ceilDivide",
        "operands": [
          {
            "op": "parameter",
            "parameter": "N"
          },
          {
            "op": "parameter",
            "parameter": "BLOCK"
          }
        ]
      }
    ],
    "block": [
      {
        "op": "parameter",
        "parameter": "BLOCK"
      }
    ],
    "numWarps": {
      "op": "literal",
      "value": 4
    },
    "displayHints": [
      "grid = (triton.cdiv(N, BLOCK),)"
    ]
  },
  "domain": {
    "domainId": "dom_catalog_ceil_grid",
    "enumerable": true,
    "variables": [
      {
        "name": "N",
        "kind": "shape",
        "type": "int",
        "width": "i32",
        "min": 1,
        "max": 4096,
        "step": 1
      },
      {
        "name": "BLOCK",
        "kind": "blockSize",
        "type": "enum",
        "values": [
          128,
          256,
          512
        ]
      },
      {
        "name": "dtype",
        "kind": "dtype",
        "type": "enum",
        "values": [
          "fp16",
          "bf16"
        ]
      }
    ],
    "constraints": [
      {
        "constraintId": "c_1",
        "lhs": {
          "op": "parameter",
          "parameter": "N"
        },
        "relation": "ge",
        "rhs": {
          "op": "literal",
          "value": 1
        }
      },
      {
        "constraintId": "c_2",
        "lhs": {
          "op": "parameter",
          "parameter": "BLOCK"
        },
        "relation": "gt",
        "rhs": {
          "op": "literal",
          "value": 0
        }
      }
    ],
    "hardwareCohortIds": [
      "hw_a100_80g"
    ]
  },
  "requiredProperties": [
    "outputCoverage",
    "memoryBounds",
    "writeWriteConflict"
  ],
  "notes": "The correct control: the same kernel with a ceiling-divided grid, so every declared output element is written.",
  "createdAt": "2026-10-12T09:18:00Z"
},
    expectedOutcome:
      "outputCoverage is established over the declared domain, under the modelled address-and-mask semantics.",
  },
];

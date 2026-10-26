"""The correct control for the floor-grid fixture.

The same kernel as ``../transform_floor_grid/kernel.py``. The defect is removed by
the scenario, not by the source: the grid is ``ceilDivide(N, BLOCK)``, so the
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

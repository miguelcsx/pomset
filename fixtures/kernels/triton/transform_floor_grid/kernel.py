"""The flagship output-coverage fixture, in the supported Triton subset.

One explicit ``@triton.jit`` entrypoint, named pointer and ``constexpr``
parameters, ``tl.program_id``, a constant-bounded ``tl.arange``, integer address
arithmetic, a boolean mask, and ``tl.load``/``tl.store`` with address and mask.
Nothing here is outside the modelled subset, so the extractor can reason about it
symbolically without executing anything.

The declared outcome is a property of the *scenario*, not of this file: with
``grid = (N // BLOCK,)`` and a remainder, the final block's lanes are all masked
off and the output is never written. With ``grid = (ceil(N / BLOCK),)`` — the
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

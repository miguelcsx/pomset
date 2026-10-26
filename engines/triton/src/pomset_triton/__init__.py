"""The Pomset Triton engine.

The symbolic path parses the kernel module as source text with :mod:`ast` and
answers a small set of queries over a declared workload domain. It never imports
or executes the user module: reading a kernel and running it are different acts,
with different trust boundaries.

The supported subset is deliberately tiny and is enumerated in
``docs/architecture/triton-engine.md``. Any construct outside it yields an
explicit ``unsupported`` result naming the construct, never a silent
approximation.
"""

__all__: list[str] = []

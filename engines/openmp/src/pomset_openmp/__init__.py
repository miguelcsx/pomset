"""The OpenMP engine.

It compiles a host-parallel C kernel with Clang and OpenMP, runs it on the
machine it is running on, and compares what came out against the scenario's
declared reference. It is the one backend whose execution needs no host and no
device, which is also why executing it needs consent: reading a kernel and
running it are different acts.
"""

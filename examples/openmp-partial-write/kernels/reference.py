"""Numerical reference for the partial-write fixture.

Every declared output element is the input doubled. The kernel under test omits
the odd ones, and that is the whole of the defect.
"""


def reference(x):
    return [value * 2.0 for value in x]

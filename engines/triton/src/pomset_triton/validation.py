"""Validate records against the same canonical schemas as TypeScript.

The check itself lives in the protocol package, because every engine refuses an
uncanonical document for the same reasons — including a number outside the
interoperable JSON range, which would not survive the canonical form the
contract hashes.
"""

from pomset_contracts.engine_protocol import InputInvalid, validate, validator

__all__ = ["InputInvalid", "validate", "validator"]

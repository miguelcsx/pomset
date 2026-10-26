"""Content identity for the engines.

The manifest hash is SHA-256 over the RFC 8785 canonical serialization of the
manifest with its own ``manifestHash`` member omitted. The TypeScript side
implements the same algorithm natively, because the RFC's number formatting is
exactly ECMAScript's; a shared fixture under ``packages/contracts/fixtures/jcs``
proves the two agree rather than assuming it.

Import from :mod:`pomset_triton.identity.manifest` directly; this package does
not re-export eagerly, so running that module with ``-m`` does not double-import
it.
"""

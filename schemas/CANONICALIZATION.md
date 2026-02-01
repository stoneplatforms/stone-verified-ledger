# Canonicalization Rules

This document defines the exact rules for canonicalizing ledger entries before signing. **These rules must be followed identically during both signing and verification.**

## Field Order

Fields must appear in this exact order:

1. `entry_id`
2. `issued_at`
3. `subject_type`
4. `subject_ref`
5. `subject_locator` (if present)
6. `policy_version`
7. `result`
8. `scores` (if present)
9. `report_hash`
10. `key_id`

**Important:** The `signature` field is **NOT** included in the canonical form. It is computed over the canonical JSON and then added to the final entry.

## Encoding

- All strings must be UTF-8 encoded
- No BOM (Byte Order Mark)
- Line endings are normalized to LF (`\n`) for the JSON string itself

## Timestamp Format

- `issued_at` must be ISO 8601 UTC format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Always use 3 decimal places for milliseconds (`.000` if no sub-second precision)
- Always use `Z` suffix (UTC, no timezone offset)

## JSON Serialization

- Use `JSON.stringify()` with no extra whitespace
- No trailing commas
- No comments
- Keys are sorted according to the field order above
- Object properties are serialized in the exact order specified

## Signature Format

- Signature is computed over the canonical JSON string (UTF-8 bytes)
- Ed25519 signature is Base64-encoded (standard encoding, no padding issues)
- Signature is added as a separate field after canonicalization

## Example

**Canonical form (before signature):**
```json
{"entry_id":"01JABCDEFGH1234567890XYZAB","issued_at":"2026-02-01T05:00:00.000Z","subject_type":"code","subject_ref":"a1b2c3d4e5f6","subject_locator":"https://github.com/stoneplatforms/some-repo","policy_version":"sv-0.1","result":"pass","scores":{"repro":7,"security":8},"report_hash":"sha256:abc123...","key_id":"stone-verified-ed25519-2026-01"}
```

**After signing (with signature added):**
```json
{"entry_id":"01JABCDEFGH1234567890XYZAB","issued_at":"2026-02-01T05:00:00.000Z","subject_type":"code","subject_ref":"a1b2c3d4e5f6","subject_locator":"https://github.com/stoneplatforms/some-repo","policy_version":"sv-0.1","result":"pass","scores":{"repro":7,"security":8},"report_hash":"sha256:abc123...","key_id":"stone-verified-ed25519-2026-01","signature":"..."}
```

## Implementation Notes

- In JavaScript/TypeScript, build the object in the exact order specified, then use `JSON.stringify(obj)` with no replacer or space arguments
- Do not rely on object property iteration order - explicitly construct the object in the correct order
- The `scores` object, if present, should have its keys sorted alphabetically for consistency

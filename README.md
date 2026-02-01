# Stone Verified Ledger

A public, append-only ledger for storing signed verification entries. This ledger provides cryptographic proof of verification results and cannot be tampered with without detection.

## Overview

The Stone Verified Ledger is a transparent, verifiable record of all verification entries issued by Stone Verified. Each entry is cryptographically signed using Ed25519, ensuring authenticity and integrity.

## Structure

```
/entries/                 # One JSON file per entry (fast lookup by entry_id)
/ledger/                  # Daily NDJSON append logs (YYYY-MM-DD.ndjson)
/keys/                    # Public keys and key registry
/scripts/                 # Signing and verification scripts
/schemas/                 # JSON schemas and canonicalization rules
/index/                   # Index files for fast subject_ref lookups
```

## How It Works

1. **Entry Creation**: A verification entry is created with all required fields
2. **Canonicalization**: The entry is canonicalized according to strict rules (see `schemas/CANONICALIZATION.md`)
3. **Signing**: The canonical JSON is signed using Ed25519 private key
4. **Storage**: The signed entry is stored in:
   - `entries/{entry_id}.json` - Individual entry file
   - `ledger/YYYY-MM-DD.ndjson` - Daily append log
   - `index/subject_ref/{hash_prefix}/{hash}.json` - Subject reference index

## Verifying Entries

### Using the Script

```bash
node scripts/verify.mjs entries/01JABCDEFGH1234567890XYZAB.json
```

### Programmatically

Entries can be verified by:
1. Fetching the entry JSON from `entries/{entry_id}.json`
2. Fetching the public key from `keys/keys.json` using the `key_id`
3. Canonicalizing the entry (excluding signature)
4. Verifying the Ed25519 signature

See `scripts/verify.mjs` for reference implementation.

## Adding Entries

### Via GitHub Actions (Recommended)

1. Go to Actions → "Append Ledger Entry" → "Run workflow"
2. Provide the JSON payload (without signature)
3. The workflow will sign and commit the entry

### Locally (Development)

```bash
export STONE_LEDGER_PRIVATE_KEY_B64="your_base64_private_key"
node scripts/sign-and-append.mjs '{"entry_id":"...","issued_at":"...",...}'
```

## Entry Schema

See `schemas/ledger-entry.schema.json` for the complete schema. Required fields:

- `entry_id`: Unique identifier (ULID format)
- `issued_at`: ISO 8601 UTC timestamp
- `subject_type`: Type of subject (code, document, artifact, repository)
- `subject_ref`: Reference to the subject (hash, commit SHA, etc.)
- `policy_version`: Verification policy version (e.g., "sv-0.1")
- `result`: Verification result (pass, fail, partial)
- `report_hash`: SHA256 hash of the full report (format: "sha256:...")
- `key_id`: Signing key identifier
- `signature`: Ed25519 signature (Base64)

Optional fields:
- `subject_locator`: URL or locator to the subject
- `scores`: Object with scoring breakdown

## Security

### Key Management

- **Public keys**: Stored in `keys/keys.json` and as `.pub` files
- **Private keys**: Stored ONLY in GitHub Secrets (`STONE_LEDGER_PRIVATE_KEY_B64`)
- Private keys are never committed to the repository

### Branch Protection

The `main` branch should be protected with:
- Require pull request reviews (or allow GitHub Actions to push directly)
- Disable force pushes
- Disable branch deletion

### Verification

Anyone can verify entries by:
1. Fetching entry files from GitHub
2. Using the public keys in `keys/keys.json`
3. Running the verification script or implementing verification logic

## Searching Entries

### By Entry ID

Direct lookup: `entries/{entry_id}.json`

### By Subject Reference

1. Compute SHA256 hash of `subject_ref`
2. Look up: `index/subject_ref/{first_2_chars}/{full_hash}.json`
3. This index file contains all `entry_ids` for that `subject_ref`

## Integration

### Vercel Site Integration

The `stoneplatforms.com` site can read entries via:
- Raw GitHub URLs: `https://raw.githubusercontent.com/{owner}/{repo}/main/entries/{entry_id}.json`
- API routes that fetch and verify entries
- Client-side verification using WebCrypto API

See the site's `src/lib/stoneLedger.ts` for the client implementation.

## Example Entry

```json
{
  "entry_id": "01JABCDEFGH1234567890XYZAB",
  "issued_at": "2026-02-01T05:00:00.000Z",
  "subject_type": "code",
  "subject_ref": "a1b2c3d4e5f6...",
  "subject_locator": "https://github.com/stoneplatforms/some-repo",
  "policy_version": "sv-0.1",
  "result": "pass",
  "scores": {
    "security": 8,
    "repro": 7
  },
  "report_hash": "sha256:abc123...",
  "key_id": "stone-verified-ed25519-2026-01",
  "signature": "..."
}
```

## Local Verification Example

```bash
# Download entry
curl https://raw.githubusercontent.com/stoneplatforms/stone-verified-ledger/main/entries/01JABCDEFGH1234567890XYZAB.json > entry.json

# Download keys
curl https://raw.githubusercontent.com/stoneplatforms/stone-verified-ledger/main/keys/keys.json > keys.json

# Verify (requires Node.js and dependencies)
node scripts/verify.mjs entry.json
```

## License

This ledger is public and entries are immutable once committed.

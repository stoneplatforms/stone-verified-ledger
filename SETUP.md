# Setup Guide

This guide will help you set up the Stone Verified Ledger repository.

## Prerequisites

- Node.js 18+ installed
- GitHub account with repository access
- Basic understanding of Git and GitHub Actions

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Signing Keys

```bash
node scripts/generate-keys.mjs
```

This will output:
- Public key (Base64) - add this to `keys/keys.json`
- Private key (Base64) - add this to GitHub Secrets

### 3. Update keys.json

Edit `keys/keys.json` and replace `REPLACE_WITH_ACTUAL_PUBLIC_KEY_BASE64` with your actual public key.

Also update the `createdAt` timestamp to the current date/time.

### 4. Save Public Key File

Save the public key to `keys/stone-verified-ed25519-YYYY-MM.pub` (replace YYYY-MM with current year-month).

### 5. Configure GitHub Secrets

1. Go to your GitHub repository settings
2. Navigate to Secrets and variables → Actions
3. Add a new secret:
   - Name: `STONE_LEDGER_PRIVATE_KEY_B64`
   - Value: Your private key (Base64 string from step 2)

### 6. Configure Branch Protection (Recommended)

1. Go to repository Settings → Branches
2. Add a branch protection rule for `main`:
   - ✅ Require a pull request before merging
   - ✅ Allow GitHub Actions to bypass (or require PR from Actions)
   - ✅ Disable force pushes
   - ✅ Disable branch deletion

## Testing

### Test Signing Locally

```bash
export STONE_LEDGER_PRIVATE_KEY_B64="your_private_key_base64"

node scripts/sign-and-append.mjs '{
  "entry_id": "01JTEST1234567890ABCDEFGHIJ",
  "issued_at": "2026-02-01T05:00:00.000Z",
  "subject_type": "code",
  "subject_ref": "test123",
  "subject_locator": "https://example.com",
  "policy_version": "sv-0.1",
  "result": "pass",
  "scores": {"security": 8, "repro": 7},
  "report_hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
}'
```

### Test Verification

```bash
node scripts/verify.mjs entries/01JTEST1234567890ABCDEFGHIJ.json
```

### Test GitHub Action

1. Go to Actions → "Append Ledger Entry"
2. Click "Run workflow"
3. Use the test payload from above (without signature)
4. Check that the entry is created and committed

## Vercel Site Integration

### Environment Variables (Optional)

In your Vercel project settings, you can optionally add:

- `STONE_LEDGER_REPO`: GitHub repo (default: `stoneplatforms/stone-verified-ledger`)
- `STONE_LEDGER_BRANCH`: Branch name (default: `main`)

These are optional and can be hardcoded in the client code.

## Troubleshooting

### "Private key length invalid"

Make sure your private key is the full 64-byte Ed25519 secret key, Base64 encoded. The public key is 32 bytes, but the private key (secret key) is 64 bytes.

### "Key ID not found"

Ensure the `key_id` in your entry matches a key ID in `keys/keys.json`.

### "Signature verification failed"

- Check that canonicalization is identical between signing and verification
- Verify the private key matches the public key in `keys.json`
- Ensure the entry hasn't been modified after signing

### GitHub Action fails to commit

- Check that the workflow has `contents: write` permission
- Verify branch protection allows GitHub Actions to push
- Ensure the private key secret is set correctly

## Next Steps

Once setup is complete:

1. Test creating an entry via GitHub Actions
2. Verify the entry appears in the repository
3. Test the Vercel site pages (`/scan` and `/v/[entry_id]`)
4. Integrate with your verification pipeline

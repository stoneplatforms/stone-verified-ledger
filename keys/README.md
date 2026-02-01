# Key Management

This directory contains public keys and the key registry for the Stone Verified Ledger.

## Generating Keys

To generate a new Ed25519 keypair:

```bash
# Using Node.js with tweetnacl (recommended)
node -e "
const nacl = require('tweetnacl');
const keypair = nacl.sign.keyPair();
console.log('Public Key (Base64):', Buffer.from(keypair.publicKey).toString('base64'));
console.log('Private Key (Base64):', Buffer.from(keypair.secretKey).toString('base64'));
"

# Or using OpenSSL
openssl genpkey -algorithm Ed25519 -outform PEM -out private.pem
openssl pkey -in private.pem -pubout -outform PEM -out public.pem
```

## Key Storage

- **Public keys**: Stored in this directory as `.pub` files and registered in `keys.json`
- **Private keys**: Stored ONLY in GitHub Secrets as `STONE_LEDGER_PRIVATE_KEY_B64` (Base64 encoded)

## Key Registry Format

The `keys.json` file contains:
- `active`: The currently active key ID
- `keys`: Object mapping key IDs to key metadata

Each key entry includes:
- `type`: Key algorithm (currently "ed25519")
- `publicKeyBase64`: Base64-encoded public key
- `createdAt`: ISO 8601 timestamp when the key was created

## Key Rotation

When rotating keys:
1. Generate new keypair
2. Add new key to `keys.json`
3. Update `active` field
4. Update GitHub Secret with new private key
5. Keep old keys in registry for verification of historical entries

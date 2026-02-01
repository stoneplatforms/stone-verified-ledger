#!/usr/bin/env node

/**
 * Generate a new Ed25519 keypair for the ledger
 * 
 * Usage: node scripts/generate-keys.mjs
 * 
 * Outputs:
 * - Public key (Base64) - add to keys/keys.json
 * - Private key (Base64) - add to GitHub Secrets as STONE_LEDGER_PRIVATE_KEY_B64
 */

import nacl from 'tweetnacl';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  // Generate Ed25519 keypair
  const keypair = nacl.sign.keyPair();
  
  const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
  const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
  
  console.log('\n=== Stone Verified Ledger Keypair ===\n');
  console.log('Public Key (Base64):');
  console.log(publicKeyBase64);
  console.log('\nPrivate Key (Base64):');
  console.log(privateKeyBase64);
  console.log('\n=== Next Steps ===\n');
  console.log('1. Add public key to keys/keys.json');
  console.log('2. Add private key to GitHub Secrets as STONE_LEDGER_PRIVATE_KEY_B64');
  console.log('3. Save public key to keys/stone-verified-ed25519-YYYY-MM.pub');
  console.log('\n⚠️  Keep the private key secure! Never commit it to the repository.\n');
  
  // Optionally save public key to a file
  const keyId = `stone-verified-ed25519-${new Date().toISOString().slice(0, 7)}`;
  const pubKeyPath = path.join(__dirname, '..', 'keys', `${keyId}.pub`);
  
  console.log(`\nSave public key to: ${pubKeyPath}? (y/n)`);
  // For non-interactive use, you can uncomment this:
  // fs.writeFileSync(pubKeyPath, publicKeyBase64 + '\n');
  // console.log(`Public key saved to ${pubKeyPath}`);
}

main();

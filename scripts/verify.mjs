#!/usr/bin/env node

/**
 * Verify a ledger entry signature
 * 
 * Usage: node scripts/verify.mjs <entry_file_path>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nacl from 'tweetnacl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Field order for canonicalization (must match CANONICALIZATION.md)
const FIELD_ORDER = [
  'entry_id',
  'issued_at',
  'subject_type',
  'subject_ref',
  'subject_locator',
  'policy_version',
  'result',
  'scores',
  'report_hash',
  'key_id'
];

/**
 * Canonicalize JSON object according to field order
 */
function canonicalize(entry) {
  const canonical = {};
  
  // Add fields in exact order
  for (const field of FIELD_ORDER) {
    if (entry[field] !== undefined) {
      if (field === 'scores' && entry[field]) {
        // Sort scores keys alphabetically
        const sortedScores = {};
        Object.keys(entry[field]).sort().forEach(key => {
          sortedScores[key] = entry[field][key];
        });
        canonical[field] = sortedScores;
      } else {
        canonical[field] = entry[field];
      }
    }
  }
  
  return JSON.stringify(canonical);
}

/**
 * Verify signature
 */
function verifySignature(canonicalJson, signatureBase64, publicKeyBase64) {
  const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
  const signatureBytes = Buffer.from(signatureBase64, 'base64');
  const messageBytes = Buffer.from(canonicalJson, 'utf8');
  
  if (publicKeyBytes.length !== 32) {
    throw new Error(`Invalid public key length: expected 32 bytes, got ${publicKeyBytes.length}`);
  }
  
  if (signatureBytes.length !== 64) {
    throw new Error(`Invalid signature length: expected 64 bytes, got ${signatureBytes.length}`);
  }
  
  return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
}

// Main execution
function main() {
  try {
    const entryPath = process.argv[2];
    if (!entryPath) {
      console.error('Usage: node scripts/verify.mjs <entry_file_path>');
      process.exit(1);
    }
    
    // Load entry
    const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
    
    if (!entry.signature) {
      console.error('Error: Entry missing signature field');
      process.exit(1);
    }
    
    if (!entry.key_id) {
      console.error('Error: Entry missing key_id field');
      process.exit(1);
    }
    
    // Load keys.json
    const keysPath = path.join(repoRoot, 'keys', 'keys.json');
    const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    
    const keyInfo = keysData.keys[entry.key_id];
    if (!keyInfo) {
      console.error(`Error: Key ID "${entry.key_id}" not found in keys.json`);
      process.exit(1);
    }
    
    if (keyInfo.type !== 'ed25519') {
      console.error(`Error: Unsupported key type: ${keyInfo.type}`);
      process.exit(1);
    }
    
    // Extract signature and create canonical form
    const { signature, ...entryWithoutSignature } = entry;
    const canonicalJson = canonicalize(entryWithoutSignature);
    
    // Verify
    const isValid = verifySignature(
      canonicalJson,
      signature,
      keyInfo.publicKeyBase64
    );
    
    if (isValid) {
      console.log(JSON.stringify({
        valid: true,
        entry_id: entry.entry_id,
        key_id: entry.key_id,
        issued_at: entry.issued_at
      }, null, 2));
      process.exit(0);
    } else {
      console.error(JSON.stringify({
        valid: false,
        entry_id: entry.entry_id,
        error: 'Signature verification failed'
      }, null, 2));
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

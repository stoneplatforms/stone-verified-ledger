#!/usr/bin/env node

/**
 * Sign and append a ledger entry
 * 
 * Usage: node scripts/sign-and-append.mjs '<payload_json>'
 * 
 * Environment:
 *   STONE_LEDGER_PRIVATE_KEY_B64 - Base64-encoded Ed25519 private key (64 bytes)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import Ajv from 'ajv';

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
 * Sign the canonical JSON
 */
function signEntry(canonicalJson, privateKeyBase64) {
  const privateKeyBytes = Buffer.from(privateKeyBase64, 'base64');
  
  if (privateKeyBytes.length !== 64) {
    throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`);
  }
  
  const messageBytes = Buffer.from(canonicalJson, 'utf8');
  const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
  
  return Buffer.from(signature).toString('base64');
}

/**
 * Create index entry for subject_ref lookup
 */
function createIndexEntry(entry) {
  const hash = crypto.createHash('sha256').update(entry.subject_ref).digest('hex');
  const first2 = hash.substring(0, 2);
  
  const indexPath = path.join(repoRoot, 'index', 'subject_ref', first2, `${hash}.json`);
  const indexDir = path.dirname(indexPath);
  
  // Read existing index if it exists
  let indexData = { subject_ref: entry.subject_ref, entry_ids: [] };
  if (fs.existsSync(indexPath)) {
    indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  
  // Add entry_id if not already present
  if (!indexData.entry_ids.includes(entry.entry_id)) {
    indexData.entry_ids.push(entry.entry_id);
  }
  
  // Ensure directory exists
  fs.mkdirSync(indexDir, { recursive: true });
  
  // Write index file
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n');
  
  return { hash, first2 };
}

// Main execution
async function main() {
  try {
    // Get payload from command line
    const payloadJson = process.argv[2];
    if (!payloadJson) {
      console.error('Usage: node scripts/sign-and-append.mjs \'<payload_json>\'');
      process.exit(1);
    }
    
    // Parse payload
    const payload = JSON.parse(payloadJson);
    
    // Load schema and validate (without signature requirement)
    const schemaPath = path.join(repoRoot, 'schemas', 'ledger-entry.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    // Create a schema without signature requirement for input validation
    const inputSchema = {
      ...schema,
      required: schema.required.filter(field => field !== 'signature')
    };
    
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(inputSchema);
    
    // Remove signature if present (we'll add it)
    const { signature: _ignoredSignature, ...payloadWithoutSignature } = payload;
    
    // Load keys.json to get key_id if not provided (needed for validation)
    const keysPath = path.join(repoRoot, 'keys', 'keys.json');
    const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    
    if (!payloadWithoutSignature.key_id) {
      payloadWithoutSignature.key_id = keysData.active;
    }
    
    if (!validate(payloadWithoutSignature)) {
      console.error('Validation errors:', JSON.stringify(validate.errors, null, 2));
      process.exit(1);
    }
    
    // Get private key from environment
    const privateKeyBase64 = process.env.STONE_LEDGER_PRIVATE_KEY_B64;
    if (!privateKeyBase64) {
      console.error('Error: STONE_LEDGER_PRIVATE_KEY_B64 environment variable not set');
      process.exit(1);
    }
    
    // Canonicalize
    const canonicalJson = canonicalize(payloadWithoutSignature);
    
    // Sign
    const signature = signEntry(canonicalJson, privateKeyBase64);
    
    // Create final entry with signature
    const entry = {
      ...payloadWithoutSignature,
      signature
    };
    
    // Write entry file
    const entryPath = path.join(repoRoot, 'entries', `${entry.entry_id}.json`);
    fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2) + '\n');
    
    // Append to daily ledger file
    const date = new Date(entry.issued_at);
    const dateStr = date.toISOString().split('T')[0];
    const ledgerPath = path.join(repoRoot, 'ledger', `${dateStr}.ndjson`);
    fs.appendFileSync(ledgerPath, canonicalJson + '\n');
    
    // Create index entry
    createIndexEntry(entry);
    
    console.log(JSON.stringify({
      success: true,
      entry_id: entry.entry_id,
      entry_path: entryPath,
      ledger_path: ledgerPath
    }, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

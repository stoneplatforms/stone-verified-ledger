#!/usr/bin/env node

/**
 * Sign and append a ledger entry
 * 
 * Usage: node scripts/sign-and-append.mjs '<json_payload>'
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nacl from 'tweetnacl';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

// Field order for canonicalization (must match verification code)
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
  
  for (const field of FIELD_ORDER) {
    // Only include field if it's defined and not null (matches verification logic)
    if (entry[field] !== undefined && entry[field] !== null) {
      if (field === 'scores' && entry.scores) {
        // Sort scores keys alphabetically
        const sortedScores = {};
        Object.keys(entry.scores).sort().forEach(key => {
          sortedScores[key] = entry.scores[key];
        });
        canonical[field] = sortedScores;
      } else {
        canonical[field] = entry[field];
      }
    }
  }
  
  // Use JSON.stringify with no spaces to ensure exact match
  return JSON.stringify(canonical);
}

/**
 * Load JSON schema
 */
function loadSchema() {
  const schemaPath = join(REPO_ROOT, 'schemas', 'ledger-entry.schema.json');
  return JSON.parse(readFileSync(schemaPath, 'utf-8'));
}

/**
 * Load keys registry
 */
function loadKeys() {
  const keysPath = join(REPO_ROOT, 'keys', 'keys.json');
  return JSON.parse(readFileSync(keysPath, 'utf-8'));
}

/**
 * Validate entry against schema using Ajv
 */
function validateEntry(entry, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(entry);
  
  if (!valid) {
    return validate.errors.map(err => {
      return `${err.instancePath || 'root'} ${err.message}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`;
    });
  }
  
  return [];
}

/**
 * Main function
 */
async function main() {
  try {
    // Get payload from command line
    const payloadJson = process.argv[2];
    if (!payloadJson) {
      console.error('Error: No payload provided');
      console.error('Usage: node scripts/sign-and-append.mjs \'<json_payload>\'');
      process.exit(1);
    }
    
    // Parse payload
    let payload;
    try {
      payload = JSON.parse(payloadJson);
    } catch (e) {
      console.error('Error: Invalid JSON payload');
      console.error(e.message);
      process.exit(1);
    }
    
    // Load schema and keys
    const schema = loadSchema();
    const keysRegistry = loadKeys();
    
    // Get active key
    const activeKeyId = keysRegistry.active;
    const keyInfo = keysRegistry.keys[activeKeyId];
    
    if (!keyInfo) {
      console.error(`Error: Active key "${activeKeyId}" not found in keys.json`);
      process.exit(1);
    }
    
    // Set key_id if not provided
    if (!payload.key_id) {
      payload.key_id = activeKeyId;
    }
    
    // Auto-add report_hash if missing (simple verification without full report)
    // IMPORTANT: Do this BEFORE validation so schema validation passes
    if (!payload.report_hash || payload.report_hash === '' || payload.report_hash === null || payload.report_hash === undefined) {
      // Generate a deterministic hash indicating simple verification
      const simpleVerificationText = `simple-verification-no-report-${payload.entry_id}`;
      const hash = createHash('sha256').update(simpleVerificationText).digest('hex');
      payload.report_hash = `sha256:${hash}`;
      console.log('ℹ️  No report_hash provided - using default for simple verification (no full report)');
      console.log(`   Generated report_hash: ${payload.report_hash}`);
    }
    
    // Debug: Log payload before validation
    console.log('📋 Payload before validation:', JSON.stringify(payload, null, 2));
    console.log('🔍 Checking report_hash:', payload.report_hash ? 'Present' : 'Missing');
    
    // Validate payload (after adding report_hash)
    const validationErrors = validateEntry(payload, schema);
    if (validationErrors.length > 0) {
      console.error('Validation errors:');
      validationErrors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }
    
    // Create canonical form (without signature)
    const canonicalJson = canonicalize(payload);
    
    // Debug: Log canonical JSON
    console.log('📝 Canonical JSON to sign:');
    console.log(canonicalJson);
    console.log('📝 Canonical JSON length:', canonicalJson.length);
    
    // Load private key
    const privateKeyB64 = process.env.STONE_LEDGER_PRIVATE_KEY_B64;
    if (!privateKeyB64) {
      console.error('Error: STONE_LEDGER_PRIVATE_KEY_B64 environment variable not set');
      process.exit(1);
    }
    
    const privateKeyBytes = Uint8Array.from(
      Buffer.from(privateKeyB64, 'base64')
    );
    
    // Validate private key length (Ed25519 private key should be 32 bytes)
    if (privateKeyBytes.length !== 32) {
      console.error(`Error: Private key length is ${privateKeyBytes.length} bytes, expected 32 bytes for Ed25519`);
      process.exit(1);
    }
    
    console.log(`🔑 Private key length: ${privateKeyBytes.length} bytes (correct for Ed25519)`);
    
    // Sign the canonical JSON
    const messageBytes = new TextEncoder().encode(canonicalJson);
    console.log(`📝 Message bytes length: ${messageBytes.length}`);
    
    const signatureBytes = nacl.sign.detached(messageBytes, privateKeyBytes);
    const signatureB64 = Buffer.from(signatureBytes).toString('base64');
    
    console.log(`✍️  Signature generated: ${signatureB64.substring(0, 20)}... (${signatureB64.length} chars)`);
    
    // Add signature to entry
    const signedEntry = {
      ...payload,
      signature: signatureB64
    };
    
    // Ensure directories exist
    const entriesDir = join(REPO_ROOT, 'entries');
    const ledgerDir = join(REPO_ROOT, 'ledger');
    const indexDir = join(REPO_ROOT, 'index', 'subject_ref');
    
    mkdirSync(entriesDir, { recursive: true });
    mkdirSync(ledgerDir, { recursive: true });
    mkdirSync(indexDir, { recursive: true });
    
    // Write entry file
    const entryFilePath = join(entriesDir, `${payload.entry_id}.json`);
    writeFileSync(entryFilePath, JSON.stringify(signedEntry, null, 2) + '\n');
    console.log(`✅ Written entry to: ${entryFilePath}`);
    
    // Append to daily ledger file
    const dateStr = new Date(payload.issued_at).toISOString().split('T')[0];
    const ledgerFilePath = join(ledgerDir, `${dateStr}.ndjson`);
    appendFileSync(ledgerFilePath, JSON.stringify(signedEntry) + '\n');
    console.log(`✅ Appended to ledger: ${ledgerFilePath}`);
    
    // Create/update index entry
    const subjectRefHash = createHash('sha256').update(payload.subject_ref).digest('hex');
    const first2 = subjectRefHash.substring(0, 2);
    const indexSubDir = join(indexDir, first2);
    mkdirSync(indexSubDir, { recursive: true });
    
    const indexFilePath = join(indexSubDir, `${subjectRefHash}.json`);
    let indexData = { subject_ref: payload.subject_ref, entry_ids: [] };
    
    if (existsSync(indexFilePath)) {
      try {
        indexData = JSON.parse(readFileSync(indexFilePath, 'utf-8'));
      } catch (e) {
        // File is corrupted, start fresh
        indexData = { subject_ref: payload.subject_ref, entry_ids: [] };
      }
    }
    
    if (!indexData.entry_ids.includes(payload.entry_id)) {
      indexData.entry_ids.push(payload.entry_id);
      writeFileSync(indexFilePath, JSON.stringify(indexData, null, 2) + '\n');
      console.log(`✅ Updated index: ${indexFilePath}`);
    }
    
    console.log(`\n✅ Successfully signed and appended entry: ${payload.entry_id}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

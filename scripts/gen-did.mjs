#!/usr/bin/env node
// Generate the did:web verification material for opchain.dev.
//
// Why: src/lib/discovery.js advertises `host.identifier: "did:web:opchain.dev"`
// in /.well-known/ai-catalog.json. For an ARD registry/agent to *verify* that
// publisher identity (not just read it), `did:web:opchain.dev` must resolve to
// a DID document at https://opchain.dev/.well-known/did.json containing a key
// the publisher controls. did:web's trust anchor is domain control — serving
// this document over opchain.dev's HTTPS *is* the proof.
//
// This script (run locally — the key must be YOURS, not generated in CI or a
// sandbox) creates an Ed25519 keypair and writes:
//   • site/public/.well-known/did.json  → PUBLIC DID document. Commit + deploy.
//   • .secrets/opchain-did-ed25519.jwk  → PRIVATE key. Gitignored. Move it to
//     your password manager / a Cloudflare secret, then delete the file. You
//     only need it later to *sign* assertions (e.g. an ARD trustManifest); the
//     resolvable did.json alone already makes the identity verifiable.
//
// Usage:
//   node scripts/gen-did.mjs          # refuses if did.json already exists
//   node scripts/gen-did.mjs --force  # rotate the key (overwrites both files)

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DID = "did:web:opchain.dev";
const DID_PATH = join(ROOT, "site", "public", ".well-known", "did.json");
const KEY_PATH = join(ROOT, ".secrets", "opchain-did-ed25519.jwk");
const force = process.argv.includes("--force");

if (existsSync(DID_PATH) && !force) {
  console.error(
    `Refusing to overwrite ${DID_PATH}.\n` +
      `It already exists — overwriting rotates the DID key and invalidates the old one.\n` +
      `Re-run with --force only if you intend to rotate.`,
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pub = publicKey.export({ format: "jwk" }); // { kty:"OKP", crv:"Ed25519", x:"..." }
const priv = privateKey.export({ format: "jwk" }); // adds the private "d" scalar

const didDocument = {
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/jws-2020/v1",
  ],
  id: DID,
  verificationMethod: [
    {
      id: `${DID}#owner`,
      type: "JsonWebKey2020",
      controller: DID,
      publicKeyJwk: { kty: pub.kty, crv: pub.crv, x: pub.x },
    },
  ],
  authentication: [`${DID}#owner`],
  assertionMethod: [`${DID}#owner`],
};

mkdirSync(dirname(DID_PATH), { recursive: true });
writeFileSync(DID_PATH, JSON.stringify(didDocument, null, 2) + "\n");

mkdirSync(dirname(KEY_PATH), { recursive: true });
writeFileSync(KEY_PATH, JSON.stringify(priv, null, 2) + "\n", { mode: 0o600 });

console.log(`✓ ${DID_PATH}`);
console.log("    PUBLIC DID document — git add + commit, then deploy.");
console.log(`✓ ${KEY_PATH}`);
console.log("    PRIVATE key — gitignored. Move it to your password manager or a");
console.log("    Cloudflare secret, then delete the file. Never commit it.");
console.log("");
console.log("Next:");
console.log("  1. git add site/public/.well-known/did.json && commit");
console.log("  2. npm run deploy:staging && npm run deploy");
console.log("  3. Verify it resolves (curl behaves like an agent — must be JSON,");
console.log("     not a Cloudflare challenge):");
console.log("       curl -sS https://opchain.dev/.well-known/did.json | head -c 200");
console.log("");
console.log(`  did:web:opchain.dev now resolves and the ai-catalog host.identifier is verifiable.`);

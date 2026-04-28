// Encrypt a secret to InsForge's AES-GCM format: iv_hex:authTag_hex:ciphertext_hex
// Used to repopulate system.secrets after a Postgres volume reset.
import { webcrypto as crypto } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here-must-be-32-char-or-above';
const PLAINTEXT = process.argv[2];
if (!PLAINTEXT) {
  console.error('Usage: node encrypt-secret.mjs <plaintext>');
  process.exit(1);
}

const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JWT_SECRET));
const cryptoKey = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']);

const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = new Uint8Array(
  await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(PLAINTEXT))
);

const authTagLen = 16;
const ciphertext = encrypted.slice(0, encrypted.length - authTagLen);
const authTag = encrypted.slice(encrypted.length - authTagLen);

const toHex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
process.stdout.write(`${toHex(iv)}:${toHex(authTag)}:${toHex(ciphertext)}`);

import { gcm } from '@noble/ciphers/aes.js';
import { getRandomBytes } from 'expo-crypto';

/**
 * On-device encryption for offline fieldwork (AES-256-GCM, 12-byte nonce, 16-byte tag).
 * The key lives only in the platform keychain (SecureStore); see offlineStorage.loadDeviceKey.
 * Text is sealed synchronously so a record save still fails loudly when storage fails.
 * Layout matches expo-crypto's combined format: nonce || ciphertext || tag.
 */
const PREFIX = 'enc:v1:';
let deviceKey: Uint8Array | null = null;

export function setDeviceKey(key: Uint8Array | null) {
  if (key && key.length !== 32) throw new Error('The device encryption key is invalid.');
  deviceKey = key;
}
export const deviceKeyBytes = () => deviceKey;
export const isSealed = (value: string) => value.startsWith(PREFIX);

// UTF-8 via binary strings: TextDecoder is not available in every Hermes build.
const utf8ToBytes = (text: string) => binaryToBytes(unescape(encodeURIComponent(text)));
const bytesToUtf8 = (bytes: Uint8Array) => decodeURIComponent(escape(bytesToBinary(bytes)));
function bytesToBinary(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return binary;
}
function binaryToBytes(binary: string) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export const toBase64 = (bytes: Uint8Array) => btoa(bytesToBinary(bytes));
export const fromBase64 = (text: string) => binaryToBytes(atob(text));

// Browser previews have no keychain; their data stays in the browser profile unencrypted.
export function sealText(plain: string) {
  if (!deviceKey) return plain;
  const nonce = getRandomBytes(12);
  const sealed = gcm(deviceKey, nonce).encrypt(utf8ToBytes(plain));
  const combined = new Uint8Array(nonce.length + sealed.length);
  combined.set(nonce); combined.set(sealed, nonce.length);
  return PREFIX + toBase64(combined);
}

// Plaintext from older app versions is accepted so it can be re-saved encrypted.
export function openText(stored: string) {
  if (!isSealed(stored)) return stored;
  if (!deviceKey) throw new Error('Saved fieldwork is encrypted, but this device key is unavailable.');
  const combined = fromBase64(stored.slice(PREFIX.length));
  try { return bytesToUtf8(gcm(deviceKey, combined.subarray(0, 12)).decrypt(combined.subarray(12))); }
  catch { throw new Error('Saved fieldwork could not be decrypted on this device.'); }
}

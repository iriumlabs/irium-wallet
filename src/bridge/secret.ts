import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i].toString(16);
    out += b.length === 1 ? '0' + b : b;
  }
  return out;
}

// Generate a 32-byte random preimage and its SHA256 hash. The hash is what
// goes into `release_conditions[].secret_hash_hex` on the agreement; the
// preimage stays on the wallet and is later revealed when building the
// release transaction. iriumd never sees the preimage.
export async function generateSecretAndHash(): Promise<{
  preimageHex: string;
  secretHashHex: string;
}> {
  const preimage = await Crypto.getRandomBytesAsync(32);
  const preimageHex = bytesToHex(preimage);
  const secretHashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    preimageHex,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return { preimageHex, secretHashHex };
}

const PREIMAGE_KEY_PREFIX = 'htlc_preimage_';

// SecureStore keys must match `^[A-Za-z0-9._-]+$` on iOS; agreement hashes
// are lowercase hex which already satisfies that.
export async function savePreimage(agreementHash: string, preimageHex: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREIMAGE_KEY_PREFIX}${agreementHash}`, preimageHex);
}

export async function loadPreimage(agreementHash: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${PREIMAGE_KEY_PREFIX}${agreementHash}`);
}

export async function deletePreimage(agreementHash: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${PREIMAGE_KEY_PREFIX}${agreementHash}`);
}

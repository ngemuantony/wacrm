import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// We need a 32-byte key for aes-256-gcm.
// It should be provided via process.env.ENCRYPTION_KEY
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. It must be a 32-byte string or hex.');
  }
  // If it's a hex string of length 64, parse it.
  if (key.length === 64 && /^[0-9a-f]+$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // If it's a 32-character string, use it directly.
  if (key.length === 32) {
    return Buffer.from(key, 'utf-8');
  }
  // Otherwise, hash it to ensure 32 bytes (Not recommended for production, but a safe fallback)
  return crypto.createHash('sha256').update(String(key)).digest();
}

/**
 * Encrypts a string using aes-256-gcm.
 * Returns a string in format `iv:authTag:encryptedData` (all hex).
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted by the `encrypt` function.
 */
export function decrypt(hash: string): string {
  if (!hash) return hash;
  
  const parts = hash.split(':');
  if (parts.length !== 3) {
    // Return original string if it wasn't encrypted by this utility (e.g. legacy cleartext)
    return hash;
  }
  
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return hash; // Return original on failure (or throw error, but returning might prevent app crashes on bad data)
  }
}

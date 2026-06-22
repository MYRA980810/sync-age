import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';
import { safeStorage } from 'electron';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text, key) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText, key) {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(key, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function saveAgentToken(db, token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encriptacion no disponible en este sistema');
  }

  const encrypted = safeStorage.encryptString(token);
  db.prepare(
    'INSERT OR REPLACE INTO agent_config (key, value) VALUES (?, ?)'
  ).run('agent_token', encrypted.toString('base64'));
}

export function getAgentToken(db) {
  const row = db.prepare(
    'SELECT value FROM agent_config WHERE key = ?'
  ).get('agent_token');

  if (!row) return null;

  const buffer = Buffer.from(row.value, 'base64');
  return safeStorage.decryptString(buffer);
}

export function getOrCreateDeviceId(db) {
  const existing = db.prepare(
    'SELECT value FROM agent_config WHERE key = ?'
  ).get('device_id');

  if (existing) return existing.value;

  const deviceId = randomUUID();
  db.prepare(
    'INSERT INTO agent_config (key, value) VALUES (?, ?)'
  ).run('device_id', deviceId);

  return deviceId;
}

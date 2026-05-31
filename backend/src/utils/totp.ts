import crypto from 'crypto';
import QRCode from 'qrcode';

export const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET || 'KAVITHAHOTEL47477226ADMINKEY32AA';

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotp(secretBase32: string, timeStepOffset = 0): string {
  const secretBuffer = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(timeStep, 4);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotp(token: string, window = 1): boolean {
  for (let offset = -window; offset <= window; offset++) {
    if (generateTotp(ADMIN_TOTP_SECRET, offset) === token) {
      return true;
    }
  }
  return false;
}

export function generateCurrentTotp(): string {
  return generateTotp(ADMIN_TOTP_SECRET);
}

export function printTotpSetup(): void {
  const label = 'admin';
  const issuer = 'Kavitha Hotel';
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${ADMIN_TOTP_SECRET}&issuer=${encodeURIComponent(issuer)}`;

  console.log(`\n==================================================`);
  console.log(`🔒 GOOGLE AUTHENTICATOR 2FA SETUP FOR ADMIN`);
  console.log(`==================================================`);
  console.log(`If you haven't linked your authenticator app yet,`);
  console.log(`scan the QR code below or enter the secret key manually:`);
  console.log(`\n🔑 Manual Secret Key: ${ADMIN_TOTP_SECRET}`);
  console.log(`🏷️ Account Name: Kavitha Hotel:admin`);
  console.log(`==================================================\n`);

  QRCode.toString(otpauthUrl, { type: 'terminal', small: true }, (err, qrString) => {
    if (!err) {
      console.log(qrString);
    } else {
      console.error('Failed to render authenticator QR code:', err);
    }
    console.log(`==================================================\n`);
  });
}

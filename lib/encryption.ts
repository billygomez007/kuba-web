import crypto from "crypto";

const algorithm = "aes-256-cbc";

function getEncryptionKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();

  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY must be configured before using application encryption.",
    );
  }

  return crypto
    .createHash("sha256")
    .update(encryptionKey)
    .digest();
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);

  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(
    algorithm,
    key,
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string) {
  const [ivHex, encryptedHex] = data.split(":");

  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, "hex"),
  );

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

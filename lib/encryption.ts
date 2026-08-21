import crypto from "crypto";

function getKey() {
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (!configuredKey && process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be configured in production.");
  }
  return crypto.createHash("sha256").update(configuredKey || "kuba-development-key").digest();
}

const algorithm = "aes-256-cbc";

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    algorithm,
    getKey(),
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

  const decipher = crypto.createDecipheriv(
    algorithm,
    getKey(),
    Buffer.from(ivHex, "hex"),
  );

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

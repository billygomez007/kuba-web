import mammoth from "mammoth";

export async function processWord(
  buffer: Buffer,
): Promise<string> {
  const result =
    await mammoth.extractRawText({
      buffer,
    });

  return result.value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

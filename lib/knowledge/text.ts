export async function processText(
  buffer: Buffer,
): Promise<string> {
  return buffer
    .toString("utf-8")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

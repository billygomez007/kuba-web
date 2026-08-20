import { PDFParse } from "pdf-parse";

export async function processPdf(
  buffer: Buffer,
): Promise<string> {
  const parser = new PDFParse({
    data: buffer,
  });

  const result = await parser.getText();

  return result.text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

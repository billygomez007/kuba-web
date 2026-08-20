import { parse } from "csv-parse/sync";

export async function processCsv(
  buffer: Buffer,
): Promise<string> {
  const text =
    buffer.toString("utf-8");

  const records =
    parse(text, {
      skip_empty_lines: true,
    });

  return records
    .map((row: unknown[]) =>
      row.join(" | "),
    )
    .join("\n")
    .trim();
}

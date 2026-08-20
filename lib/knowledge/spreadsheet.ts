import * as XLSX from "xlsx";

export async function processSpreadsheet(
  buffer: Buffer,
): Promise<string> {
  const workbook =
    XLSX.read(buffer, {
      type: "buffer",
    });

  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet =
      workbook.Sheets[sheetName];

    const csv =
      XLSX.utils.sheet_to_csv(sheet);

    if (csv.trim()) {
      sections.push(
        `SHEET: ${sheetName}\n${csv.trim()}`,
      );
    }
  }

  return sections.join("\n\n").trim();
}

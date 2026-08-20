import { processPdf } from "./pdf";
import { processWord } from "./word";
import { processSpreadsheet } from "./spreadsheet";
import { processCsv } from "./csv";
import { processText } from "./text";


export type KnowledgeProcessingResult = {
  text: string;
  type: string;
};


export async function processKnowledgeFile(
  buffer: Buffer,
  fileType: string,
  mimeType: string | null,
): Promise<KnowledgeProcessingResult> {

  switch (fileType) {

    case "pdf":
      return {
        type: "pdf",
        text: await processPdf(buffer),
      };


    case "word":
      return {
        type: "word",
        text: await processWord(buffer),
      };


    case "excel":
      return {
        type: "excel",
        text:
          await processSpreadsheet(buffer),
      };


    case "csv":
      return {
        type: "csv",
        text: await processCsv(buffer),
      };


    case "text":
      return {
        type: "text",
        text: await processText(buffer),
      };


    default:

      if (
        mimeType?.startsWith("text/")
      ) {
        return {
          type: "text",
          text:
            await processText(buffer),
        };
      }

      throw new Error(
        `No processor available for file type: ${fileType}`,
      );
  }
}

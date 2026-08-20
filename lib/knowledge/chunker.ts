const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 200;

export function chunkKnowledgeText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): string[] {
  const cleaned = text.trim();

  if (!cleaned) {
    return [];
  }

  if (overlap >= chunkSize) {
    throw new Error(
      "Chunk overlap must be smaller than chunk size.",
    );
  }

  const chunks: string[] = [];

  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(
      start + chunkSize,
      cleaned.length,
    );

    let chunk = cleaned.slice(start, end);

    if (end < cleaned.length) {
      const lastBreak = Math.max(
        chunk.lastIndexOf("\n\n"),
        chunk.lastIndexOf(". "),
      );

      if (lastBreak > chunkSize * 0.6) {
        chunk = chunk.slice(
          0,
          lastBreak + 1,
        );
      }
    }

    chunk = chunk.trim();

    if (chunk) {
      chunks.push(chunk);
    }

    const advance = Math.max(
      chunk.length - overlap,
      1,
    );

    start += advance;
  }

  return chunks;
}

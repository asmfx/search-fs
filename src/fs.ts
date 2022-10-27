import fsp from "fs/promises";

export interface ILineContent {
  raw: string;
  content: string;
  trimmed: string;
  lineNumber: number;
}

export const readLines = async (filepath: string): Promise<ILineContent[]> => {
  const content = await fsp.readFile(filepath);

  return content
    .toString()
    .split("\n")
    .map((raw, idx) => ({
      raw,
      content: raw.trimEnd(),
      trimmed: raw.trim(),
      lineNumber: idx + 1,
    }));
};

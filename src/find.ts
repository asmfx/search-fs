import fsp from "fs/promises";
import fs from "fs";
import path from "path";

export interface IFindOptions {
  pattern?: RegExp;
  maxDepth?: number;
}

export interface IFindResult {
  name: string;
  fullpath: string;
  dirpath: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

export const find = async (
  startingPath: string,
  options: IFindOptions
): Promise<IFindResult[]> => {
  const { pattern, maxDepth } = options;

  const files = await fsp.readdir(startingPath);
  const result = pattern ? files.filter((i) => pattern.test(i)) : files;

  const list: IFindResult[] = result.map((name): IFindResult => {
    const fullpath = path.join(startingPath, name);
    const stat = fs.lstatSync(fullpath);
    const isDirectory = stat.isDirectory();
    const isFile = stat.isFile();
    const isSymbolicLink = stat.isSymbolicLink();

    return {
      name,
      fullpath,
      dirpath: startingPath,
      isFile,
      isDirectory,
      isSymbolicLink,
    };
  });

  if (maxDepth === undefined || maxDepth != 0) {
    const recursiveFind = await Promise.all(
      list
        .filter((item) => item.isDirectory)
        .map((item) =>
          find(item.fullpath, {
            ...options,
            maxDepth: maxDepth ? maxDepth - 1 : undefined,
          })
        )
    );
    list.push(...recursiveFind.flat());
  }
  return list;
};

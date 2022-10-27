import fs from "fs";
import _ from "lodash";
import { ILineContent, readLines } from "./fs";
import { find } from "./find";

const DEFAULT_BATCH_SIZE = 10;

interface IGrepOptions {
  groupAnalysis?: boolean;
  preFormatter?: (line: string) => string | undefined;
  preFilter?: ((line: string) => boolean) | RegExp;
  postFilter?: (match: IGrepMatch) => boolean;
}

interface IGrepDirOptions extends IGrepOptions {
  maxDepth?: number;
  batchSize?: number;
}

interface IGrepAdvancedOptions extends IGrepDirOptions {}

interface IGrepMatch {
  file: string;
  line: ILineContent;
  text: string;
  groups?: Record<string, string>;
  details: RegExpMatchArray;
}

interface IGrepLineMatch {
  file: string;
  line: ILineContent;
  matches: IGrepMatch[];
}

interface IGrepFileResult {
  file: string;
  lineMatches: IGrepLineMatch[];
  allMatches: IGrepMatch[];
  groups?: Record<string, IGrepMatch[]>;
  groupAnalysis?: Record<string, Record<string, IGrepMatch[]>>;
}

interface IGrepResult {
  fileMatches?: IGrepFileResult[];
  lineMatches?: IGrepLineMatch[];
  allMatches?: IGrepMatch[];
  groups?: Record<string, IGrepMatch[]>;
  groupAnalysis?: Record<string, Record<string, IGrepMatch[]>>;
}

const getGroupAnalysis = (matches: IGrepMatch[]) => {
  const groups: Record<string, IGrepMatch[]> = _.chain(
    matches.filter((i) => i.groups)
  )
    .flatten()
    .flatMap((i) => Object.keys(i.groups!).map((key) => ({ key, ...i })))
    .groupBy((i) => i.key)
    .value() as unknown as Record<string, IGrepMatch[]>;

  const groupAnalysis: Record<string, Record<string, IGrepMatch[]>> = {};
  for (const _key of Object.keys(groups)) {
    groupAnalysis[_key] = _.chain(groups[_key])
      .map((item) => ({ ...item, key: item.groups?.[_key] || `null` }))
      .groupBy((i) => i.key)
      .value();
  }
  return { groups, groupAnalysis };
};

export const grepFile = async (
  file: string,
  pattern: RegExp | RegExp[],
  { groupAnalysis, preFormatter, preFilter, postFilter }: IGrepOptions
): Promise<IGrepFileResult> => {
  const lines = await readLines(file);

  preFilter =
    preFilter && typeof preFilter != "function" ? preFilter.test : preFilter;

  const lineProcessor = (
    line: ILineContent,
    expression: RegExp,
    targetContent: string
  ) => {
    const _matches: IGrepMatch[] = [];
    for (const match of targetContent.matchAll(expression)) {
      _matches.push({
        file,
        line,
        text: match[0],
        groups: match.groups,
        details: match,
      });
    }
    return _matches;
  };

  const lineMatches = lines
    .map((line: ILineContent) => {
      let matches: IGrepMatch[] = [];

      if (
        preFilter &&
        typeof preFilter === "function" &&
        !preFilter(line.content)
      ) {
        return [];
      }

      const targetContent = preFormatter
        ? preFormatter(line.content)
        : line.content;

      if (!targetContent) {
        return [];
      }

      if (Array.isArray(pattern)) {
        matches = pattern
          .map((p) => lineProcessor(line, p, targetContent))
          .flat();
      } else {
        matches = lineProcessor(line, pattern, targetContent);
      }

      if (postFilter && matches.length) {
        matches = matches.filter(postFilter);
      }

      return matches.length ? [{ file, line, matches }] : [];
    })
    .flat();

  const allMatches: IGrepMatch[] = lineMatches.flatMap((i) => i.matches);
  const analysis = groupAnalysis ? getGroupAnalysis(allMatches) : {};

  return { file, lineMatches, allMatches, ...analysis };
};

export const grep = async (
  paths: string | string[],
  pattern: RegExp | RegExp[],
  options: IGrepAdvancedOptions
): Promise<IGrepResult> => {
  const { maxDepth, groupAnalysis, batchSize = DEFAULT_BATCH_SIZE } = options;
  const _pathItems = (typeof paths === "string" ? [paths] : paths).map(
    (path) => {
      const stat = fs.lstatSync(path);
      const isDirectory = stat.isDirectory();
      const isFile = stat.isFile();
      return { path, isFile, isDirectory };
    }
  );

  const _files1 = (
    await Promise.all(
      _pathItems
        .filter((i) => i.isDirectory)
        .map((item) => find(item.path, { maxDepth }))
    )
  )
    .flat()
    .map((r) => r.fullpath);
  const _files2 = _pathItems.filter((i) => i.isFile).map((i) => i.path);

  const fileMatches: IGrepFileResult[] = [];
  const fileGroups = _.chunk([..._files1, ..._files2], batchSize);
  for (const fileGroup of fileGroups) {
    const batchResult = (
      await Promise.all(
        fileGroup.map((file) => grepFile(file, pattern, options))
      )
    ).filter((i) => i.allMatches?.length);
    fileMatches.push(...batchResult);
  }

  const lineMatches = fileMatches.flatMap((i) => i.lineMatches);
  const allMatches = fileMatches.flatMap((i) => i.allMatches);
  const analysis = groupAnalysis ? getGroupAnalysis(allMatches) : {};

  return { fileMatches, lineMatches, allMatches, ...analysis };
};

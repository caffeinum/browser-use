import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const comparablePath = (filePath: string) => {
  const absolutePath = path.resolve(filePath);
  let resolvedPath = absolutePath;

  try {
    resolvedPath = fs.realpathSync.native(absolutePath);
  } catch {
    resolvedPath = absolutePath;
  }

  return process.platform === 'win32'
    ? resolvedPath.toLowerCase()
    : resolvedPath;
};

export const isMainModule = (
  moduleUrl: string,
  argv1: string | undefined = process.argv[1]
) => {
  if (!argv1) {
    return false;
  }

  try {
    return comparablePath(fileURLToPath(moduleUrl)) === comparablePath(argv1);
  } catch {
    return false;
  }
};

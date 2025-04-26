import { failure, ok, Result } from "./result.js";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export function readFile(path: string): Result<Buffer> {
  let data;
  try {
    data = readFileSync(path);
  } catch (e) {
    return failure(`Failed to read from '${path}', error ${e}.`);
  }

  return ok(data);
}

export function storeFile(
  data: Buffer,
  dirPath: string,
  fileName: string
): Result<string> {
  let path = "";
  const arrPath = dirPath.includes("/") ? dirPath.split("/") : [dirPath];
  try {
    arrPath.forEach((key) => {
      path += path.length > 0 ? `/${key}` : key;
      if (!existsSync(path)) {
        mkdirSync(path);
      }
    });
    path += `/${fileName}`;
    writeFileSync(path, data);
  } catch (e) {
    return failure(`Couldn't store the file ${e}`);
  }

  return ok(path);
}

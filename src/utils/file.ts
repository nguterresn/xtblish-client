import { failure, ok, Result } from "./result.js";
import { readFileSync, writeFileSync } from "node:fs";

export function readFile(path: string): Result<Buffer> {
  let data;
  try {
    data = readFileSync(path);
  } catch (e) {
    return failure(`Failed to read from '${path}', error ${e}.`);
  }

  return ok(data);
}

export function writeFile(path: string, data: Buffer): Result<Buffer> {
  try {
    writeFileSync(path, data);
  } catch (e) {
    return failure(`Failed to write to '${path}', error ${e}.`);
  }

  return ok(data);
}

import { fs } from "assemblyscript/util/node.js";
import { xtblishConfig } from "../config.js";
import { ok, failure, Result } from "./result.js";

export function checkEnvVariables(config: string): Result<xtblishConfig> {
  if (!config) {
    return failure("Configuration path is empty");
  }

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(config, "utf8"));
  } catch (e) {
    return failure(`Failed to read or parse JSON with error: ${e}`);
  }

  return ok(obj as xtblishConfig);
}

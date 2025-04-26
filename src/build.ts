import { Buffer } from "node:buffer";
import { statSync } from "node:fs";
import asc from "assemblyscript/asc";
import got, { PlainResponse } from "got";
import { sign } from "crypto";
import { failure, ok, Result } from "./utils/result.js";
import { xtblishConfig } from "./config.js";

export interface buildOptions {
  source: string;
  group: string;
  config: string;
}

export async function compileAssemblyScript(
  source: string,
  config: xtblishConfig
): Promise<Result<string>> {
  try {
    statSync(source);
    const { error, stdout, stderr, stats } = await asc.main([
      source,
      "--outFile",
      `${config.outAppDir}/main.wasm`,
      "--textFile",
      `${config.outAppDir}/main.wat`,
      "--target",
      "release",
      "-Ospeed",
      "--bindings",
      "esm",
    ]);
    if (error) {
      console.log(stderr);
      return failure(error.message);
    }
  } catch (e) {
    return failure(`Error -> ${e}`);
  }

  return ok(`${config.outAppDir}/main.wasm`);
}

export function signApp(app: Buffer, config: xtblishConfig): Result<Buffer> {
  if (!config.org.signKey) {
    return failure("Secret does not exist!");
  }

  // Allocate space for extra packet configuration.
  let dataToSign = Buffer.alloc(512 + 4, 0xff); // 0xFF means erased
  dataToSign = Buffer.concat([dataToSign, app]);
  dataToSign.writeUInt32LE(app.length, 512); // Write size of main.wasm

  // Sign.
  let signature;
  try {
    signature = sign(null, dataToSign, config.org.signKey); // Signature is 64 bytes long.
  } catch (e) {
    return failure(`Failed to sign app`);
  }

  const dataToEncrypt = Buffer.concat([signature, dataToSign]);

  return ok(dataToEncrypt);
}

export async function postApplication(
  data: Buffer,
  config: xtblishConfig,
  groupId: string
): Promise<Result<PlainResponse>> {
  let response;
  try {
    response = await got.post(
      `http://192.168.0.140:3000/app/${config.org.id}/${groupId}`,
      {
        body: data,
        responseType: "json",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": `${data.length}`,
          Authorization: `${config.user.apiKey}`,
        },
      }
    );
  } catch (e: any) {
    return failure(
      `On attempt to POST /app/${config.org.id}/${groupId}: ${
        e instanceof Error ? e.message : e
      }`
    );
  }

  return ok(response);
}

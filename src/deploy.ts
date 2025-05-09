import { Buffer } from "node:buffer";
import { statSync } from "node:fs";
import asc from "assemblyscript/asc";
import got, { PlainResponse } from "got";
import { sign } from "crypto";
import { failure, ok, Result } from "./utils/result.js";
import { xtblishConfig } from "./config.js";
import dotenv from "dotenv";
dotenv.config();

export interface buildOptions {
  source: string;
  group: string;
  config: string;
  flags: string | null;
}

export async function compileAssemblyScript(
  options: buildOptions,
  config: xtblishConfig
): Promise<Result<string>> {
  try {
    statSync(options.source);
    let args = [
      options.source,
      "--outFile",
      `${config.outAppDir}/main.wasm`,
      "--textFile",
      `${config.outAppDir}/main.wat`,
      "--target",
      "release",
      "-Ospeed",
      "--bindings",
      "esm",
    ];
    if (options.flags) {
      args.concat(options.flags.split(" "));
    }
    const { error, stdout, stderr, stats } = await asc.main(args);
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
  let dataToSign = Buffer.alloc(256 + 4, 0xff); // 0xFF means erased
  dataToSign = Buffer.concat([dataToSign, app]);
  dataToSign.writeUInt32LE(app.length, 256); // Write size of main.wasm

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
    response = await got.post(`https://${process.env.HOST}/app/${groupId}`, {
      body: data,
      https: { rejectUnauthorized: false },
      responseType: "json",
      throwHttpErrors: false,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": `${data.length}`,
        Authorization: config.user.apiKey,
      },
    });
  } catch (e: any) {
    return failure(
      `On attempt to POST /app/${groupId}: ${
        e instanceof Error ? e.message : e
      }`
    );
  }

  if (response && response.statusCode > 300) {
    return failure(
      `Failed to upload app under POST /app/${groupId}: ${JSON.stringify(
        response.body
      )}`
    );
  }

  return ok(response);
}

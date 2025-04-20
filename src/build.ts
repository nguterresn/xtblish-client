import asc from "assemblyscript/asc";
import { fs } from "assemblyscript/util/node.js";
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
): Promise<Result<number>> {
  try {
    fs.statSync(source);
    const { error, stdout, stderr, stats } = await asc.main([
      source,
      "--outFile",
      `${config.outDir}/main.wasm`,
      "--textFile",
      `${config.outDir}/main.wat`,
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

  return ok(0);
}

export function signAndCreateBinary(
  config: xtblishConfig
): Result<Buffer<ArrayBuffer>> {
  const wasmFilePath = `${config.outDir}/main.wasm`;
  const signedBinFilePath = `${config.outDir}/signed-main.bin`;

  if (!config.user.signKey) {
    return failure("Secret does not exist!");
  }

  let wasmFile = Buffer.from("");
  try {
    wasmFile = fs.readFileSync(wasmFilePath);
  } catch (e) {
    return failure(`Failed to read from '${wasmFilePath}', error ${e}.`);
  }

  let dataToSign = Buffer.alloc(512 + 4, 0x00); // in order: config, size
  dataToSign = Buffer.concat([dataToSign, wasmFile]);
  dataToSign.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm

  const signature = sign(null, dataToSign, config.user.signKey); // Signature is 64 bytes long.
  const data = Buffer.concat([signature, dataToSign]);

  try {
    fs.writeFileSync(signedBinFilePath, data);
  } catch (e) {
    return failure(`Failed to write to '${signedBinFilePath}', error ${e}.`);
  }

  return ok(data);
}

export async function postApplication(
  data: Buffer<ArrayBuffer>,
  config: xtblishConfig,
  groupId: string
): Promise<Result<PlainResponse>> {
  let response;
  try {
    response = await got.post(
      `http://192.168.0.140:3000/app/${config.org.id}/${config.user.id}/${groupId}`,
      {
        body: data,
        responseType: "json",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": `${data.length}`,
        },
      }
    );
  } catch (e: any) {
    return failure(
      `On attempt to POST /app/${config.org.id}/${config.user.id}/${groupId}: ${
        e instanceof Error ? e.message : e
      }`
    );
  }

  return ok(response);
}

import asc from "assemblyscript/asc";
import { fs } from "assemblyscript/util/node.js";
import got, { PlainResponse } from "got";
import { failure, ok, Result } from "./utils.js";
import { sign } from "crypto";

interface xtblishConfig {
  outDir: string;
  signKey: string;
}

export interface buildOptions {
  source: string;
  user: string;
  config: string;
}

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

export function signAndCreateBinary(config: xtblishConfig): Result<Buffer<ArrayBuffer>> {
  const wasmFilePath = `${config.outDir}/main.wasm`;
  const signedBinFilePath = `${config.outDir}/signed-main.bin`;

  if (!config.signKey) {
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

  let key: string;
  try {
    key = fs.readFileSync(config.signKey, "utf-8");
  } catch (e) {
    return failure(`Failed to read from '${config.signKey}', error ${e}.`);
  }

  const signature = sign(null, dataToSign, key); // Signature is 64 bytes long.
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
  userId: string
): Promise<Result<PlainResponse>> {
  let response;
  try {
    response = await got.post(`http://192.168.0.140:3000/app/${userId}`, {
      body: data,
      responseType: "json",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": `${data.length}`,
      },
    });
  } catch (e: any) {
    return failure(`On attempt to POST /app/${userId}: ${e instanceof Error ? e.message : e}`);
  }

  return ok(response);
}

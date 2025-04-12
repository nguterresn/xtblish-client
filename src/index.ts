#!/usr/bin/env node

import { program } from "commander";
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto";
import fs from "fs";
import { failure, ok, isError } from "./utils.js";

import type { PlainResponse } from "got";
import type { Result, Ok } from "./utils.js";

interface xtblishConfig {
  secret: string;
  outDir: string;
}

program
  .name("xtblish CLI")
  .description("Send WASM files to the xtblish server.")
  .version("1.0.14")
  .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
  .requiredOption("-u, --user <id>", "input your user ID (e.g. 123)")
  .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
  .option("-d, --dev", "post firmware locally", false)
  .parse();
const options = program.opts();

main();

async function main() {
  const jsonResult = checkEnvVariables(options.config);
  if (isError(jsonResult)) {
    return;
  }
  const compileResult = await compileAssemblyScript(
    options.source,
    (jsonResult as Ok<xtblishConfig>).data
  );
  if (isError(compileResult)) {
    return;
  }
  const hashResult = hashAndCreateBinary((jsonResult as Ok<xtblishConfig>).data);
  if (isError(hashResult)) {
    return;
  }
  const responseResult = await postApplication(
    (hashResult as Ok<Buffer<ArrayBuffer>>).data,
    options.user,
    options.dev
  );
  if (isError(responseResult)) {
    return;
  }

  console.log(
    `Status Code: ${(responseResult as Ok<PlainResponse>).data.statusCode}
    Body: ${JSON.stringify((responseResult as Ok<PlainResponse>).data.body)}`
  );
}

// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //

async function compileAssemblyScript(
  source: string,
  config: xtblishConfig
): Promise<Result<number>> {
  try {
    fs.statSync(source);
    // Release alternative:
    // asc --outFile build/release.wasm --textFile build/release.wat --sourceMap false --optimizeLevel 3 --shrinkLevel 0 --converge false --noAssert false --bindings esm
    const { error, stdout, stderr, stats } = await asc.main([
      source,
      "--outFile",
      `${config.outDir}/debug.wasm`,
      "--textFile",
      `${config.outDir}/debug.wat`,
      "--sourceMap",
      "false",
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

function hashAndCreateBinary(config: xtblishConfig): Result<Buffer<ArrayBuffer>> {
  const wasmFilePath = `${config.outDir}/debug.wasm`;
  const signedBinFilePath = `${config.outDir}/signed-debug.bin`;

  if (!config.secret) {
    return failure("Secret does not exist!");
  }

  let wasmFile = Buffer.from("");
  try {
    wasmFile = fs.readFileSync(wasmFilePath);
  } catch (e) {
    return failure(`Failed to read from '${wasmFilePath}', error ${e}.`);
  }

  let dataToHash = Buffer.alloc(512 + 4, 0x00); // in order: config, size
  dataToHash = Buffer.concat([dataToHash, wasmFile]);
  dataToHash.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm

  const hash = crypto.createHmac("sha256", config.secret).update(dataToHash).digest();
  const data = Buffer.concat([hash, dataToHash]);

  try {
    fs.writeFileSync(signedBinFilePath, data);
  } catch (e) {
    return failure(`Failed to write to '${signedBinFilePath}', error ${e}.`);
  }

  return ok(data);
}

async function postApplication(
  data: Buffer<ArrayBuffer>,
  userId: number,
  isDev: boolean
): Promise<Result<PlainResponse>> {
  if (!isDev) {
    return failure("Production mode is not supported yet.");
  }

  let response;
  try {
    response = await got.post(`http://192.168.0.140:3000/firmware/${userId}`, {
      body: data,
      responseType: "json",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": `${data.length}`,
      },
    });
  } catch (e: any) {
    return failure(`On attempt to POST /firmware/${userId}: ${e instanceof Error ? e.message : e}`);
  }

  return ok(response);
}

function checkEnvVariables(config: string): Result<xtblishConfig> {
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

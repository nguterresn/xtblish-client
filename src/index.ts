import { program } from "commander";
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto";
import fs from "fs";
import dotenv from "dotenv";
import { failure, ok, isError } from "./utils.js";

import type { PlainResponse } from "got";
import type { Result, Ok } from "./utils.js";

interface xtblishConfig {
  secret: string;
  asFilePath: string;
}

dotenv.config();

program
  .name("xtblish CLI")
  .description("Send WASM files to the xtblish server.")
  .version("1.0.0")
  .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
  .requiredOption("-u, --user <id>", "input your user ID (e.g. 123)")
  .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
  .option("-d, --debug", "use the debug build")
  .parse();
const options = program.opts();

main();

async function main() {
  const jsonResult = checkEnvVariables(options.config);
  if (isError(jsonResult)) {
    return;
  }
  const compileResult = await compileAssemblyScript(options.source);
  if (isError(compileResult)) {
    return;
  }
  const hashResult = hashWasmFile(
    `build/${options.debug ? "debug" : "release"}.wasm`,
    (jsonResult as Ok<xtblishConfig>).data.secret
  );
  if (isError(hashResult)) {
    return;
  }
  const responseResult = await postApplication(
    (hashResult as Ok<Buffer<ArrayBuffer>>).data,
    options.user
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

async function compileAssemblyScript(pathToIndex: string): Promise<Result<number>> {
  if (!fs.statSync(pathToIndex)) {
    return failure(`Assembly script file under '${pathToIndex}' is not found!`);
  }

  const { error, stdout, stderr, stats } = await asc.main([pathToIndex, "--optimize"]);
  if (error) {
    console.log(stderr);
    return failure(error.message);
  }

  return ok(0);
}

function hashWasmFile(filePath: string, secret: string): Result<Buffer<ArrayBuffer>> {
  if (!filePath) {
    return failure("WASM file (AS_FILE) not defined!");
  }
  if (!fs.statSync(filePath)) {
    return failure(`WASM file under '${filePath}' is not found!`);
  }

  const wasmFile = fs.readFileSync(filePath);

  let dataToHash = Buffer.alloc(512 + 4, 0x00); // in order: config, size
  dataToHash = Buffer.concat([dataToHash, wasmFile]);
  dataToHash.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm
  if (!secret) {
    return failure("Secret does not exist!");
  }

  const hash = crypto.createHmac("sha256", secret).update(dataToHash).digest();

  return ok(Buffer.concat([hash, dataToHash]));
}

async function postApplication(
  data: Buffer<ArrayBuffer>,
  userId: number
): Promise<Result<PlainResponse>> {
  let response;
  try {
    response = await got.post(`${process.env.SERVER_URL}/firmware/${userId}`, {
      body: data,
      responseType: "json",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": `${data.length}`,
      },
    });
  } catch (e: any) {
    return failure(`On attempt to POST /${process.env.SERVER_URL}/firmware/${userId}: ${e}`);
  }

  return ok(response);
}

function checkEnvVariables(config: string): Result<xtblishConfig> {
  if (!process.env.SERVER_URL) {
    // This is temporary for now.
    return failure("Cannot find 'SERVER_URL' under .env");
  }
  if (!config) {
    return failure("Configuration path is empty");
  }
  if (!fs.statSync(config)) {
    return failure(`Cannot find configuration file at ${config}`);
  }

  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(config, "utf8"));
  } catch (e) {
    return failure(`Failed to read or parse JSON with error: ${e}`);
  }

  return ok(obj as xtblishConfig);
}

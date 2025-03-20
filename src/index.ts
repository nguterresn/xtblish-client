// Usage of ASC
// https://www.assemblyscript.org/compiler.html#programmatic-usage

import { program } from "commander"
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto"
import fs from "fs"
import dotenv from "dotenv"
import { failure, ok, isError } from "./utils.ts";

import type { PlainResponse } from "got";
import type { Result, Ok } from "./utils.ts";

dotenv.config()

program.option('--sign');
program.parse();
const options = program.opts();

main();

async function main() {
  const check = checkEnvVariables();
  if (isError(check)) {
    return;
  }
  const result = await compileAssemblyScript('./assembly/index.ts')
  if (isError(result)) {
    return;
  }
  const hashResult = hashWasmFile()
  if (isError(hashResult)) {
    return;
  }

  const response = await postApplication((hashResult as Ok<Buffer<ArrayBuffer>>).data)
  if (isError(response)) {
    return;
  }

  console.log(
    `Status Code: ${(response as Ok<PlainResponse>).data.statusCode}
    Body: ${JSON.stringify((response as Ok<PlainResponse>).data.body)}`
  )
}

// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //

async function compileAssemblyScript(pathToIndex: string): Promise<Result<number>> {
  const { error, stdout, stderr, stats } = await asc.main([pathToIndex, "--optimize"]);
  if (error) {
    console.log(stderr);
    return failure(error.message);
  }

  return ok(0);
}

function hashWasmFile(): Result<Buffer<ArrayBuffer>> {
  const filePath: string | undefined = process.env.AS_FILE
  if (!filePath) {
    return failure("Assembly Script file (AS_FILE) not defined!");
  }
  if (!fs.statSync(filePath)) {
    return failure(`Assembly script file under '${filePath}' is not found!`);
  }

  const wasmFile = fs.readFileSync(filePath)

  let dataToHash = Buffer.alloc(512 + 4, 0x00) // in order: config, size
  dataToHash = Buffer.concat([dataToHash, wasmFile]);
  dataToHash.writeUInt32LE(wasmFile.length, 512) // Write size of main.wasm
  if (!process.env.HMAC_SECRET) {
    return failure("HMAC Secret does not exist!");
  }

  const hash = crypto.createHmac('sha256', process.env.HMAC_SECRET).update(dataToHash).digest()

  return ok(Buffer.concat([hash, dataToHash]));
}

async function postApplication(data: Buffer<ArrayBuffer>): Promise<Result<PlainResponse>> {
  let response
  try {
    response = await got.post(`${process.env.SERVER_URL}/firmware/${process.env.DEVICE_ID}`, {
      body: data,
      responseType: 'json',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': `${data.length}`,
      },
    });
  } catch (e: any) {
    return failure(`On attempt to POST /${process.env.SERVER_URL}/firmware/${process.env.DEVICE_ID}: ${e}`);
  }

  return ok(response);
}

function checkEnvVariables(): Result<number> {
  if (process.env.SERVER_URL) {
    return failure("Cannot find 'SERVER_URL' under .env");
  }
  if (process.env.HMAC_SECRET) {
    return failure("Cannot find 'HMAC_SECRET' under .env");
  }
  if (process.env.AS_FILE) {
    return failure("Cannot find 'AS_FILE' under .env");
  }
  if (process.env.USER_ID) {
    return failure("Cannot find 'USER_ID' under .env");
  }

  return ok(0);
}

// Usage of ASC
// https://www.assemblyscript.org/compiler.html#programmatic-usage

import { program } from "commander"
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto"
import fs from "fs"

import dotenv from "dotenv"
dotenv.config()

program.option('--sign');
program.parse();

const options = program.opts();

if (options.sign) {
  const error = await compileAssemblyScript('./assembly/index.ts')
  if (!error) {
    const binary = hashWasmFile()
    const response = await postApplication(binary)

    console.log(`Status Code: ${response.statusCode} Body: ${JSON.stringify(response.body)}`)
  }
}

// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //

async function compileAssemblyScript(pathToIndex) {
  const { error, stdout, stderr, stats } = await asc.main([pathToIndex, "--optimize"]);
  return error ? error : 0
}

function hashWasmFile() {
  const filePath = process.env.AS_FILE
  if (!fs.statSync(filePath)) {
    return
  }
  const wasmFile = fs.readFileSync(filePath)

  let dataToHash = Buffer.alloc(512 + 4, 0x00) // in order: config, size
  dataToHash = Buffer.concat([dataToHash, wasmFile]);
  dataToHash.writeUInt32LE(wasmFile.length, 512) // Write size of main.wasm

  const hash = crypto.createHmac('sha256', process.env.HMAC_SECRET).update(dataToHash).digest()

  return Buffer.concat([hash, dataToHash]);
}

async function postApplication(data) {
  const response = await got.post(`${process.env.SERVER_URL}/firmware/${process.env.DEVICE_ID}`, {
    body: data,
    responseType: 'json',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': data.length,
    },
  });

  return response
}

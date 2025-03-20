// Usage of ASC
// https://www.assemblyscript.org/compiler.html#programmatic-usage
import { program } from "commander";
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto";
import fs from "fs";
import dotenv from "dotenv";
import { failure, ok, isError, getData } from "./utils.ts";
dotenv.config();
program.option('--sign');
program.parse();
const options = program.opts();
main();
async function main() {
    const result = await compileAssemblyScript('./assembly/index.ts');
    if (isError(result)) {
        return;
    }
    const hashResult = hashWasmFile();
    if (isError(hashResult)) {
        return;
    }
    const response = await postApplication(getData(hashResult));
    if (isError(response)) {
        return;
    }
    console.log(`Status Code: ${response.data.statusCode}
    Body: ${JSON.stringify(response.data.body)}`);
}
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
async function compileAssemblyScript(pathToIndex) {
    const { error, stdout, stderr, stats } = await asc.main([pathToIndex, "--optimize"]);
    if (error) {
        console.log(stderr);
        return failure(error);
    }
    return ok(0);
}
function hashWasmFile() {
    const filePath = process.env.AS_FILE;
    if (!filePath || !fs.statSync(filePath)) {
        return failure(new Error("File not found / File does not exist!"));
    }
    const wasmFile = fs.readFileSync(filePath);
    let dataToHash = Buffer.alloc(512 + 4, 0x00); // in order: config, size
    dataToHash = Buffer.concat([dataToHash, wasmFile]);
    dataToHash.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm
    if (!process.env.HMAC_SECRET) {
        return failure(new Error("HMAC Secret does not exist!"));
    }
    const hash = crypto.createHmac('sha256', process.env.HMAC_SECRET).update(dataToHash).digest();
    return ok(Buffer.concat([hash, dataToHash]));
}
async function postApplication(data) {
    let response;
    try {
        response = await got.post(`${process.env.SERVER_URL}/firmware/${process.env.DEVICE_ID}`, {
            body: data,
            responseType: 'json',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': `${data.length}`,
            },
        });
    }
    catch (e) {
        return failure(new Error(e));
    }
    return ok(response);
}

import { program } from "commander";
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto";
import fs from "fs";
import dotenv from "dotenv";
import { failure, ok, isError } from "./utils.js";
dotenv.config();
program
    .name("xtblish CLI")
    .description("Send WASM files to the xtblish server.")
    .version("1.0.0")
    .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
    .requiredOption("-u, --user <id>", "input your user ID (e.g. 123)")
    .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
    .parse();
const options = program.opts();
main();
async function main() {
    const jsonResult = checkEnvVariables(options.config);
    if (isError(jsonResult)) {
        return;
    }
    const compileResult = await compileAssemblyScript(options.source, jsonResult.data);
    if (isError(compileResult)) {
        return;
    }
    const hashResult = hashWasmFile(jsonResult.data);
    if (isError(hashResult)) {
        return;
    }
    const responseResult = await postApplication(hashResult.data, options.user);
    if (isError(responseResult)) {
        return;
    }
    console.log(`Status Code: ${responseResult.data.statusCode}
    Body: ${JSON.stringify(responseResult.data.body)}`);
}
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
// -------------------------- //  // -------------------------- // // -------------------------- //
async function compileAssemblyScript(source, config) {
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
            "--debug",
            "--sourceMap",
            "false",
            "--bindings",
            "esm",
        ]);
        if (error) {
            console.log(stderr);
            return failure(error.message);
        }
    }
    catch (e) {
        return failure(`Error" ${e}`);
    }
    return ok(0);
}
function hashWasmFile(config) {
    const filePath = `${config.outDir}/debug.wasm`;
    if (!config.secret) {
        return failure("Secret does not exist!");
    }
    let wasmFile = Buffer.from("");
    try {
        wasmFile = fs.readFileSync(filePath);
    }
    catch (e) {
        return failure(`Failed to read from '${filePath}' error ${e}`);
    }
    let dataToHash = Buffer.alloc(512 + 4, 0x00); // in order: config, size
    dataToHash = Buffer.concat([dataToHash, wasmFile]);
    dataToHash.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm
    const hash = crypto.createHmac("sha256", config.secret).update(dataToHash).digest();
    return ok(Buffer.concat([hash, dataToHash]));
}
async function postApplication(data, userId) {
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
    }
    catch (e) {
        return failure(`On attempt to POST /${process.env.SERVER_URL}/firmware/${userId}: ${e}`);
    }
    return ok(response);
}
function checkEnvVariables(config) {
    if (!process.env.SERVER_URL) {
        // This is temporary for now.
        return failure("Cannot find 'SERVER_URL' under .env");
    }
    if (!config) {
        return failure("Configuration path is empty");
    }
    let obj;
    try {
        obj = JSON.parse(fs.readFileSync(config, "utf8"));
    }
    catch (e) {
        return failure(`Failed to read or parse JSON with error: ${e}`);
    }
    return ok(obj);
}

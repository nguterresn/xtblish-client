#!/usr/bin/env node
import { program } from "commander";
import got from "got";
import asc from "assemblyscript/asc";
import crypto from "crypto";
import fs from "fs";
import { failure, ok, isError } from "./utils.js";
program
    .name("xtblish CLI")
    .description("Send WASM files to the xtblish server.")
    .version("1.0.17")
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
    const compileResult = await compileAssemblyScript(options.source, jsonResult.data);
    if (isError(compileResult)) {
        return;
    }
    const hashResult = hashAndCreateBinary(jsonResult.data);
    if (isError(hashResult)) {
        return;
    }
    const responseResult = await postApplication(hashResult.data, options.user, options.dev);
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
            `${config.outDir}/main.wasm`,
            "--textFile",
            `${config.outDir}/main.wat`,
            "-target",
            "release",
            "-Ospeed",
            "--bindings",
            "esm",
        ]);
        if (error) {
            console.log(stderr);
            return failure(error.message);
        }
    }
    catch (e) {
        return failure(`Error -> ${e}`);
    }
    return ok(0);
}
function hashAndCreateBinary(config) {
    const wasmFilePath = `${config.outDir}/main.wasm`;
    const signedBinFilePath = `${config.outDir}/signed-main.bin`;
    if (!config.secret) {
        return failure("Secret does not exist!");
    }
    let wasmFile = Buffer.from("");
    try {
        wasmFile = fs.readFileSync(wasmFilePath);
    }
    catch (e) {
        return failure(`Failed to read from '${wasmFilePath}', error ${e}.`);
    }
    let dataToHash = Buffer.alloc(512 + 4, 0x00); // in order: config, size
    dataToHash = Buffer.concat([dataToHash, wasmFile]);
    dataToHash.writeUInt32LE(wasmFile.length, 512); // Write size of main.wasm
    const hash = crypto.createHmac("sha256", config.secret).update(dataToHash).digest();
    const data = Buffer.concat([hash, dataToHash]);
    try {
        fs.writeFileSync(signedBinFilePath, data);
    }
    catch (e) {
        return failure(`Failed to write to '${signedBinFilePath}', error ${e}.`);
    }
    return ok(data);
}
async function postApplication(data, userId, isDev) {
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
    }
    catch (e) {
        return failure(`On attempt to POST /firmware/${userId}: ${e instanceof Error ? e.message : e}`);
    }
    return ok(response);
}
function checkEnvVariables(config) {
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

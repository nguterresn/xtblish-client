#!/usr/bin/env node
import { program } from "commander";
import tracer from "tracer";
import { compileAssemblyScript, signApp, postApplication, } from "./build.js";
import { checkEnvVariables } from "./utils/config.js";
import { getFactoryImage } from "./provision.js";
import { readFile, storeFile } from "./utils/file.js";
const logger = tracer.console({
    format: "{{timestamp}} <{{title}}> - {{message}}",
});
program.name("xtblish CLI").version("1.1.9");
program
    .command("build")
    .description("Compile, sign and deploy an xtblish application.")
    .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
    .requiredOption("-g, --group <id>", "input your group ID (e.g. 123)")
    .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
    .action(handleCommandBuild);
program
    .command("provision")
    .description("Setup a virtual xtblish device.")
    .requiredOption("-b, --board <name>", "Device board (Zephyr)")
    .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
    .action(handleCommandProvision);
program.parse();
async function handleCommandBuild(options) {
    const jsonResult = checkEnvVariables(options.config);
    if (jsonResult.isError()) {
        return;
    }
    const config = jsonResult.unwrap();
    const compileResult = await compileAssemblyScript(options.source, config);
    if (compileResult.isError()) {
        return;
    }
    const wasmApp = readFile(compileResult.unwrap());
    if (wasmApp.isError()) {
        return;
    }
    const appResult = signApp(wasmApp.unwrap(), config);
    if (appResult.isError()) {
        return;
    }
    const writeResult = storeFile(appResult.unwrap(), `${config.outAppDir}`, "signed-app.bin");
    if (writeResult.isError()) {
        return;
    }
    const responseResult = await postApplication(appResult.unwrap(), config, options.group);
    if (responseResult.isError()) {
        return;
    }
    logger.info(`Status Code: ${responseResult.unwrap().statusCode}
    Body: ${JSON.stringify(responseResult.unwrap().body)}`);
}
async function handleCommandProvision(options) {
    const jsonResult = checkEnvVariables(options.config);
    if (jsonResult.isError()) {
        return;
    }
    const config = jsonResult.unwrap();
    // Get the factory image from the xtblish server.
    const responseResult = await getFactoryImage(options.board, config);
    if (responseResult.isError()) {
        return;
    }
    const writeResult = storeFile(responseResult.unwrap().rawBody, config.outImageDir, "factory-bootimage.bin");
    if (writeResult.isError()) {
        return;
    }
    logger.info(`Image is stored under ${writeResult.unwrap()}`);
}

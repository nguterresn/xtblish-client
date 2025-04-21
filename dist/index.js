#!/usr/bin/env node
import { program } from "commander";
import tracer from "tracer";
import { compileAssemblyScript, signEncryptApp, postApplication, } from "./build.js";
import { checkEnvVariables } from "./utils/config.js";
import { readFile, writeFile } from "./utils/file.js";
const logger = tracer.console({
    format: "{{timestamp}} <{{title}}> - {{message}}",
});
program.name("xtblish CLI").version("1.1.4");
program
    .command("build")
    .description("Compile, sign, encrypt and deploy an xtblish application.")
    .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
    .requiredOption("-g, --group <id>", "input your group ID (e.g. 123)")
    .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
    .action(handleCommandBuild);
program
    .command("provision")
    .description("Setup a virtual xtblish device.")
    .requiredOption("-b, --board <name>", "Device board (Zephyr)")
    .requiredOption("-c, --config <path>", "input configuration file, e.g. xtblish.json")
    .option("-f, --file <path>", "Custom board YAML file (Zephyr)")
    .option("-d, --dts <path>", "Custom board device tree file (Zephyr)")
    .option("-k, --kconfig <path>", "Device Kconfig file (Zephyr)")
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
    const appResult = signEncryptApp(wasmApp.unwrap(), config);
    if (appResult.isError()) {
        return;
    }
    const writeResult = writeFile(`${config.outAppDir}/enc-app.bin`, appResult.unwrap());
    if (writeResult.isError()) {
        return;
    }
    const responseResult = await postApplication(writeResult.unwrap(), config, options.group);
    if (responseResult.isError()) {
        return;
    }
    logger.info(`Status Code: ${responseResult.unwrap().statusCode}
    Body: ${JSON.stringify(responseResult.unwrap().body)}`);
}
function handleCommandProvision(options) {
    const jsonResult = checkEnvVariables(options.config);
    if (jsonResult.isError()) {
        return;
    }
    const config = jsonResult.unwrap();
    logger.error(`Provision is not ready yet!`);
}

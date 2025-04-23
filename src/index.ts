#!/usr/bin/env node

import { program } from "commander";
import tracer from "tracer";

import {
  buildOptions,
  compileAssemblyScript,
  signApp,
  postApplication,
} from "./build.js";
import { checkEnvVariables } from "./utils/config.js";
import { getFactoryImage, provisionOptions } from "./provision.js";
import { readFile, writeFile } from "./utils/file.js";
import { xtblishConfig } from "./config.js";
import { execSync } from "node:child_process";

const logger = tracer.console({
  format: "{{timestamp}} <{{title}}> - {{message}}",
});

program.name("xtblish CLI").version("1.1.5");

program
  .command("build")
  .description("Compile, sign and deploy an xtblish application.")
  .requiredOption(
    "-s, --source <path>",
    "input Assembly Script source file path (e.g. index.ts)"
  )
  .requiredOption("-g, --group <id>", "input your group ID (e.g. 123)")
  .requiredOption(
    "-c, --config <path>",
    "input configuration file, e.g. xtblish.json"
  )
  .action(handleCommandBuild);

program
  .command("provision")
  .description("Setup a virtual xtblish device.")
  .requiredOption("-b, --board <name>", "Device board (Zephyr)")
  .requiredOption(
    "-c, --config <path>",
    "input configuration file, e.g. xtblish.json"
  )
  .option("-f, --flash", "Flash")
  .option("-y, --yaml <path>", "Custom board YAML file (Zephyr)")
  .option("-d, --dts <path>", "Custom board device tree file (Zephyr)")
  .option("-k, --kconfig <path>", "Device Kconfig file (Zephyr)")
  .action(handleCommandProvision);

program.parse();

async function handleCommandBuild(options: buildOptions) {
  const jsonResult = checkEnvVariables(options.config);
  if (jsonResult.isError()) {
    return;
  }
  const config: xtblishConfig = jsonResult.unwrap();
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

  const writeResult = writeFile(
    `${config.outAppDir}/signed-app.bin`,
    appResult.unwrap()
  );
  if (writeResult.isError()) {
    return;
  }

  const responseResult = await postApplication(
    writeResult.unwrap(),
    config,
    options.group
  );
  if (responseResult.isError()) {
    return;
  }

  logger.info(
    `Status Code: ${responseResult.unwrap().statusCode}
    Body: ${JSON.stringify(responseResult.unwrap().body)}`
  );
}

async function handleCommandProvision(options: provisionOptions) {
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

  // Temporaly save the file locally.
  const file = `${config.outImageDir}/factory-${options.board}.bin`;
  const writeResult = writeFile(file, responseResult.unwrap().rawBody!);
  if (writeResult.isError()) {
    return;
  }

  // Flash device
  try {
    execSync(
      "/Users/nunonogueira/Projectos/zephyr-projects/modules/hal/espressif/tools/esptool_py/esptool.py " +
        "--baud 921600 --before default_reset " +
        "--after hard_reset write_flash " +
        "-u --flash_mode dio --flash_freq 40m " +
        `--flash_size detect 0x20000 ${file}`
    );
  } catch (e) {
    logger.error(e);
    return;
  }
}

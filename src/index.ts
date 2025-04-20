#!/usr/bin/env node

import { program } from "commander";
import tracer from "tracer";

import {
  buildOptions,
  compileAssemblyScript,
  signAndCreateBinary,
  postApplication,
} from "./build.js";
import { checkEnvVariables } from "./utils/config.js";
import { provisionOptions } from "./provision.js";

const logger = tracer.console({
  format: "{{timestamp}} <{{title}}> - {{message}}",
});

program.name("xtblish CLI").version("1.0.21");

program
  .command("build")
  .description("Compile, sign, encrypt and deploy an xtblish application.")
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
  .option("-f, --file <path>", "Custom board YAML file (Zephyr)")
  .option("-d, --dts <path>", "Custom board device tree file (Zephyr)")
  .option("-k, --kconfig <path>", "Device Kconfig file (Zephyr)")
  .action(handleCommandProvision);

program.parse();

async function handleCommandBuild(options: buildOptions) {
  const jsonResult = checkEnvVariables(options.config);
  if (jsonResult.isError()) {
    return;
  }
  const config = jsonResult.unwrap();
  const compileResult = await compileAssemblyScript(options.source, config);
  if (compileResult.isError()) {
    return;
  }
  const hashResult = signAndCreateBinary(config);
  if (hashResult.isError()) {
    return;
  }
  const responseResult = await postApplication(
    hashResult.unwrap(),
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

function handleCommandProvision(options: provisionOptions) {
  const jsonResult = checkEnvVariables(options.config);
  if (jsonResult.isError()) {
    return;
  }

  logger.info(`Provision Done!`);
}

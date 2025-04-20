#!/usr/bin/env node

import { program } from "commander";
import {
  buildOptions,
  checkEnvVariables,
  compileAssemblyScript,
  signAndCreateBinary,
  postApplication,
} from "./build.js";

import tracer from "tracer";

const logger = tracer.console({
  format: "{{timestamp}} <{{title}}> - {{message}}",
});

program.name("xtblish CLI").version("1.0.21");

program
  .command("build")
  .description("Compile, sign, encrypt and deploy an xtblish application.")
  .requiredOption("-s, --source <path>", "input Assembly Script source file path (e.g. index.ts)")
  .requiredOption("-u, --user <id>", "input your user ID (e.g. 123)")
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

async function handleCommandBuild(options: buildOptions) {
  const jsonResult = checkEnvVariables(options.config);
  if (jsonResult.isError()) {
    return;
  }
  const compileResult = await compileAssemblyScript(options.source, jsonResult.unwrap());
  if (compileResult.isError()) {
    return;
  }
  const hashResult = signAndCreateBinary(jsonResult.unwrap());
  if (hashResult.isError()) {
    return;
  }
  const responseResult = await postApplication(hashResult.unwrap(), options.user);
  if (responseResult.isError()) {
    return;
  }

  logger.info(
    `Status Code: ${responseResult.unwrap().statusCode}
    Body: ${JSON.stringify(responseResult.unwrap().body)}`
  );
}

function handleCommandProvision(options: any) {}

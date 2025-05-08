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
import { readFile, storeFile } from "./utils/file.js";
import { xtblishConfig } from "./config.js";

const logger = tracer.console({
  format: "{{timestamp}} <{{title}}> - {{message}}",
});

program.name("xtblish CLI").version("1.1.17");

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
  .option(
    "-f, --flags <flags>",
    "optional flags to add to the Assembly Script compilation"
  )
  .action(handleCommandBuild);

program.parse();

async function handleCommandBuild(options: buildOptions) {
  const jsonResult = checkEnvVariables(options.config);
  if (jsonResult.isError()) {
    return;
  }
  const config: xtblishConfig = jsonResult.unwrap();
  const compileResult = await compileAssemblyScript(options, config);
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

  const writeResult = storeFile(
    appResult.unwrap(),
    `${config.outAppDir}`,
    "signed-app.bin"
  );
  if (writeResult.isError()) {
    return;
  }

  const responseResult = await postApplication(
    appResult.unwrap(),
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

// Usage of ASC
// https://www.assemblyscript.org/compiler.html#programmatic-usage

import { program } from "commander"
import asc from "assemblyscript/asc";
import crypto from "crypto"

program.option('--example').argument('<string>');
program.parse();

const options = program.opts();
console.log(`${options.example} : ${program.args}`)

const { error, stdout, stderr, stats } = await asc.main([
  // Command line options
  "assembly/index.ts",
  "--outFile", "assembly/build/main.wasm",
  "--optimize",
  "--stats"
]);
if (error) {
  console.log("Compilation failed: " + error.message);
  console.log(stderr.toString());
} else {
  console.log(stdout.toString());
}

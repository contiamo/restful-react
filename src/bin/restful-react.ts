#!/usr/bin/env node

import program from "commander";
import { readFileSync } from "fs";
import { join } from "path";

const { version } = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

program
  .version(version)
  .command("import [open-api-file]", "generate restful typed components from open-api specs")
  .parse(process.argv);

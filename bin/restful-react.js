#!/usr/bin/env node

const program = require("commander");
const { join } = require("path");
const { readFileSync } = require("fs");

const package = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

program
  .version(package.version)
  .command("import [open-api-file]", "generate restful typed components from open-api specs")
  .parse(process.argv);

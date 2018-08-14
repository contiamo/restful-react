#!/usr/bin/env node

const program = require("commander");
const { join } = require("path");
const importOpenApi = require("../dist/import-open-api");
const { writeFileSync } = require("fs");

program.option("-o, --output", "output file destination").parse(process.argv);

const data = importOpenApi(join(process.cwd(), program.args[0]));
writeFileSync(join(process.cwd(), program.output), data);

console.log(`Your open-api specs is now convert into ready to use restful-react components!`);

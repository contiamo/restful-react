#!/usr/bin/env node

const program = require("commander");
const { join } = require("path");
const importOpenApi = require("../dist/import-open-api").default;
const { writeFileSync } = require("fs");

program.option("-o, --output [value]", "output file destination");
program.option("-u, --url [value]", "base url of the server");
program.parse(process.argv);

const data = importOpenApi(join(process.cwd(), program.args[0]), program.url);
writeFileSync(join(process.cwd(), program.output), data);

console.log(`Your open-api specs is now convert into ready to use restful-react components!`);

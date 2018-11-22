import program from "commander";
import { writeFileSync } from "fs";
import { join } from "path";
import importOpenApi from "../scripts/import-open-api";

program.option("-o, --output [value]", "output file destination");
program.option("-u, --url [value]", "base url of the server");
program.parse(process.argv);

importOpenApi(join(process.cwd(), program.args[0]), program.url)
  .then(data => {
    writeFileSync(join(process.cwd(), program.output), data);

    // tslint:disable-next-line:no-console
    console.log(`Your open-api specs is now convert into ready to use restful-react components!`);
  })
  .catch(err => {
    // tslint:disable-next-line:no-console
    console.error(err);
  });

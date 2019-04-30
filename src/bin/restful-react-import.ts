import program from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";
import inquirer from "inquirer";
import { join, parse } from "path";
import request from "request";

import importOpenApi from "../scripts/import-open-api";

program.option("-o, --output [value]", "output file destination");
program.option("-f, --file [value]", "input file (yaml or json openapi specs)");
program.option("-g, --github [value]", "github path (format: `owner:repo:branch:path`)");
program.option("-t, --transformer [value]", "transformer function path");
program.parse(process.argv);

(async () => {
  const transformer = program.transformer ? require(join(process.cwd(), program.transformer)) : undefined;

  if (!program.output) {
    throw new Error("You need to provide an output file with `--output`");
  }
  if (!program.file && !program.github) {
    throw new Error("You need to provide an input specification with `--file` or `--github`");
  }

  if (program.file) {
    const data = readFileSync(join(process.cwd(), program.file), "utf-8");
    const { ext } = parse(program.file);
    const format = [".yaml", ".yml"].includes(ext.toLowerCase()) ? "yaml" : "json";

    return importOpenApi(data, format, transformer);
  } else if (program.github) {
    let accessToken: string;
    const githubTokenPath = join(__dirname, ".githubToken");
    if (existsSync(githubTokenPath)) {
      accessToken = readFileSync(githubTokenPath, "utf-8");
    } else {
      const answers = await inquirer.prompt<{ githubToken: string; saveToken: boolean }>([
        {
          type: "input",
          name: "githubToken",
          message:
            "Please provide a GitHub token with `repo` rules checked (https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/)",
        },
        {
          type: "confirm",
          name: "saveToken",
          message: "Would you like to store your token for the next time? (stored in your node_modules)",
        },
      ]);
      if (answers.saveToken) {
        writeFileSync(githubTokenPath, answers.githubToken);
      }
      accessToken = answers.githubToken;
    }
    const [owner, repo, branch, path] = program.github.split(":");

    const options = {
      method: "POST",
      url: "https://api.github.com/graphql",
      headers: {
        "content-type": "application/json",
        "user-agent": "restful-react-importer",
        authorization: `bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `query {
          repository(name: "${repo}", owner: "${owner}") {
            object(expression: "${branch}:${path}") {
              ... on Blob {
                text
              }
            }
          }
        }`,
      }),
    };

    return new Promise((resolve, reject) => {
      request(options, (error, _, body) => {
        if (error) {
          return reject(error);
        }

        const format =
          program.github.toLowerCase().includes(".yaml") || program.github.toLowerCase().includes(".yml")
            ? "yaml"
            : "json";
        resolve(importOpenApi(JSON.parse(body).data.repository.object.text, format, transformer));
      });
    });
  } else {
    return Promise.reject("Please provide a file (--file) or a github (--github) input");
  }
})()
  .then(data => {
    writeFileSync(join(process.cwd(), program.output), data);

    // tslint:disable-next-line:no-console
    console.log(`🎉 Your OpenAPI spec has been converted into ready to use restful-react components!`);
  })
  .catch(err => {
    // tslint:disable-next-line:no-console
    console.error(err);
  });

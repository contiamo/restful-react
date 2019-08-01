import chalk from "chalk";
import program from "commander";
import { readFileSync, writeFileSync } from "fs";
import get from "lodash/get";
import { join, parse } from "path";
import request from "request";

import { githubAuth } from "../scripts/github-auth";
import importOpenApi from "../scripts/import-open-api";

const log = console.log; // tslint:disable-line:no-console

program.option("-o, --output [value]", "output file destination");
program.option("-f, --file [value]", "input file (yaml or json openapi specs)");
program.option("-g, --github [value]", "github path (format: `owner:repo:branch:path`)");
program.option("-t, --transformer [value]", "transformer function path");
program.option("--github-auth-url [value]", "lambda url to have an access token from github");
program.option("--no-validation", "skip the validation step (provided by ibm-openapi-validator)");
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

    return importOpenApi(data, format, transformer, program.validation);
  } else if (program.github) {
    const [owner, repo, branch, path] = program.github.split(":");
    if (!owner || !repo || !branch || !path) {
      throw new Error("The github path is not valid, expected format: `owner:repo:branch:path`");
    }

    const accessToken = await githubAuth({ githubLoginUrl: program.githubAuthUrl });

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
      request(options, async (error, _, rawBody) => {
        if (error) {
          return reject(error);
        }

        const body = JSON.parse(rawBody);
        if (!body.data || !body.data.repository || !body.data.repository.object) {
          return reject(body.message || get(body, "errors.0.message") || "Specifications not found!");
        }

        const format =
          program.github.toLowerCase().includes(".yaml") || program.github.toLowerCase().includes(".yml")
            ? "yaml"
            : "json";
        resolve(importOpenApi(body.data.repository.object.text, format, transformer, program.validation));
      });
    });
  } else {
    return Promise.reject("Please provide a file (--file) or a github (--github) input");
  }
})()
  .then(data => {
    writeFileSync(join(process.cwd(), program.output), data);
    log(chalk.green(`🎉  Your OpenAPI spec has been converted into ready to use restful-react components!`));
  })
  .catch(err => {
    log(chalk.red(err));
  });

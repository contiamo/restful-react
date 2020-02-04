import chalk from "chalk";
import program from "commander";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import inquirer from "inquirer";
import difference from "lodash/difference";
import { join, parse } from "path";
import request from "request";
import { homedir } from "os";
import slash from "slash";

import importOpenApi from "../scripts/import-open-api";
import { OperationObject } from "openapi3-ts";

const log = console.log; // tslint:disable-line:no-console

export interface Options {
  output: string;
  file?: string;
  url?: string;
  github?: string;
  transformer?: string;
  validation?: boolean;
}

export type AdvancedOptions = Options & {
  customImport?: string;
  customProps?: {
    base?: string;
  };
  customGenerator?: (data: {
    componentName: string;
    verb: string;
    route: string;
    description: string;
    genericsTypes: string;
    operation: OperationObject;
    paramsInPath: string[];
    paramsTypes: string;
  }) => string;
};

export interface ExternalConfigFile {
  [backend: string]: AdvancedOptions;
}

program.option("-o, --output [value]", "output file destination");
program.option("-f, --file [value]", "input file (yaml or json openapi specs)");
program.option("-u, --url [value]", "url to spec (yaml or json openapi specs)");
program.option("-g, --github [value]", "github path (format: `owner:repo:branch:path`)");
program.option("-t, --transformer [value]", "transformer function path");
program.option("--validation", "add the validation step (provided by ibm-openapi-validator)");
program.option("--config [value]", "override flags by a config file");
program.parse(process.argv);

const createSuccessMessage = (backend?: string) =>
  chalk.green(
    `${
      backend ? `[${backend}] ` : ""
    }🎉  Your OpenAPI spec has been converted into ready to use restful-react components!`,
  );

const successWithoutOutputMessage = chalk.yellow("Success! No output path specified; printed to standard output.");

const importSpecs = async (options: AdvancedOptions) => {
  const transformer = options.transformer ? require(join(process.cwd(), options.transformer)) : undefined;

  if (!options.file && !options.url && !options.github) {
    throw new Error("You need to provide an input specification with `--file`, '--url', or `--github`");
  }

  if (options.file) {
    const data = readFileSync(join(process.cwd(), options.file), "utf-8");
    const { ext } = parse(options.file);
    const format = [".yaml", ".yml"].includes(ext.toLowerCase()) ? "yaml" : "json";

    return importOpenApi({
      data,
      format,
      transformer,
      validation: options.validation,
      customImport: options.customImport,
      customProps: options.customProps,
      customGenerator: options.customGenerator,
    });
  } else if (options.url) {
    const { url } = options;

    const urlSpecReq = {
      method: "GET",
      url,
      headers: {
        "user-agent": "restful-react-importer",
      },
    };

    return new Promise((resolve, reject) => {
      request(urlSpecReq, async (error, response, body) => {
        if (error) {
          return reject(error);
        }

        // Attempt to determine format
        // will default to yaml as it
        // also supports json fully
        let format: "json" | "yaml" = "yaml";
        if (url.endsWith(".json") || response.headers["content-type"] === "application/json") {
          format = "json";
        }

        resolve(
          importOpenApi({
            data: body,
            format,
            transformer,
            validation: options.validation,
            customImport: options.customImport,
            customProps: options.customProps,
            customGenerator: options.customGenerator,
          }),
        );
      });
    });
  } else if (options.github) {
    const { github } = options;

    let accessToken: string;
    const githubTokenPath = join(homedir(), ".restful-react");
    if (existsSync(githubTokenPath)) {
      accessToken = readFileSync(githubTokenPath, "utf-8");
    } else {
      const answers = await inquirer.prompt<{ githubToken: string; saveToken: boolean }>([
        {
          type: "input",
          name: "githubToken",
          message:
            "Please provide a GitHub token with `repo` rules checked ( https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line )",
        },
        {
          type: "confirm",
          name: "saveToken",
          message: `Would you like to store your token for the next time? (stored in your ${slash(githubTokenPath)})`,
        },
      ]);
      if (answers.saveToken) {
        writeFileSync(githubTokenPath, answers.githubToken);
      }
      accessToken = answers.githubToken;
    }
    const [owner, repo, branch, path] = github.split(":");

    const githubSpecReq = {
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
      request(githubSpecReq, async (error, _, rawBody) => {
        if (error) {
          return reject(error);
        }

        const body = JSON.parse(rawBody);
        if (!body.data) {
          if (body.message === "Bad credentials") {
            const answers = await inquirer.prompt<{ removeToken: boolean }>([
              {
                type: "confirm",
                name: "removeToken",
                message: "Your token doesn't have the correct permissions, should we remove it?",
              },
            ]);
            if (answers.removeToken) {
              unlinkSync(githubTokenPath);
            }
          }
          return reject(body.message);
        }

        const format =
          github.toLowerCase().includes(".yaml") || github.toLowerCase().includes(".yml") ? "yaml" : "json";
        resolve(
          importOpenApi({
            data: body.data.repository.object.text,
            format,
            transformer,
            validation: options.validation,
            customImport: options.customImport,
            customProps: options.customProps,
            customGenerator: options.customGenerator,
          }),
        );
      });
    });
  } else {
    return Promise.reject("Please provide a file (--file), a url (--url), or a github (--github) input");
  }
};

if (program.config) {
  // Use config file as configuration (advanced usage)

  // tslint:disable-next-line: no-var-requires
  const config: ExternalConfigFile = require(join(process.cwd(), program.config));

  const mismatchArgs = difference(program.args, Object.keys(config));
  if (mismatchArgs.length) {
    log(
      chalk.yellow(
        `${mismatchArgs.join(", ")} ${mismatchArgs.length === 1 ? "is" : "are"} not defined in your configuration!`,
      ),
    );
  }

  Object.entries(config)
    .filter(([backend]) => (program.args.length === 0 ? true : program.args.includes(backend)))
    .forEach(([backend, options]) => {
      importSpecs(options)
        .then(data => {
          if (options.output) {
            writeFileSync(join(process.cwd(), options.output), data);
            log(createSuccessMessage(backend));
          } else {
            log(data);
            log(successWithoutOutputMessage);
          }
        })
        .catch(err => {
          log(chalk.red(err));
          process.exit(1);
        });
    });
} else {
  // Use flags as configuration
  importSpecs((program as any) as Options)
    .then(data => {
      if (program.output) {
        writeFileSync(join(process.cwd(), program.output), data);
        log(createSuccessMessage());
      } else {
        log(data);
        log(successWithoutOutputMessage);
      }
    })
    .catch(err => {
      log(chalk.red(err));
      process.exit(1);
    });
}

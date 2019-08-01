import bodyParser from "body-parser";
import express from "express";
import { Server } from "http";

// tslint:disable-next-line: no-var-requires
const open = require("open");

export const CLI_PORT = 666;

/**
 * Handle the github auth flow.
 *
 * We ask for a `repo` access to be able to fetch any swagger spec file.
 *
 * @returns oauth-token
 */
export const githubAuth = (
  options = {
    githubLoginUrl: "http://localhost:9000/github-login",
  },
): Promise<string> => {
  const app = express();
  app.use(bodyParser.text());
  return new Promise(resolve => {
    let server: Server;
    app.post("/", (req, res) => {
      resolve(req.body);
      res.end();
      if (server) {
        server.close();
      }
    });
    server = app.listen(CLI_PORT, () => {
      open(options.githubLoginUrl);
    });
  });
};

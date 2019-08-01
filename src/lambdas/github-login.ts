import { APIGatewayEvent, Callback, Context, Handler } from "aws-lambda";
import isEmpty from "lodash/isEmpty";
import request from "request";
import { CLI_PORT } from "../scripts/github-auth";

// Config from netlify
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_STATE, DEPLOY_URL } = process.env;

const LAMBDA_URL = DEPLOY_URL + "/github-login";

export const handler: Handler = (event: APIGatewayEvent, _: Context, callback: Callback) => {
  if (!event.queryStringParameters || isEmpty(event.queryStringParameters)) {
    // No query params -> redirect to github
    return callback(undefined, {
      statusCode: 301,
      headers: {
        Location: `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo&redirect_uri=${LAMBDA_URL}&state=${GITHUB_STATE}`,
      },
    });
  } else if (event.queryStringParameters.code) {
    // Callback from github -> Retrieve access token
    if (event.queryStringParameters.state !== GITHUB_STATE) {
      return callback(new Error("Session compromised! Some cross-site request detected!"));
    }

    request(
      {
        method: "POST",
        url: "https://github.com/login/oauth/access_token",
        body: {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: event.queryStringParameters.code,
          state: GITHUB_STATE,
        },
        json: true,
      },
      (err, __, body) => {
        return callback(err, {
          statusCode: 200,
          // Send back the access_token to the CLI
          body: `
<html>
<script>
  fetch("http://localhost:${CLI_PORT}", {
    method: "POST",
    body: "${body.access_token}",
    mode: "no-cors"
  }).then(() => window.close())
</script>
<body>
  <p>You can close this page and continue to import your open-api specs 😁</p>
  <p>Enjoy this new world of type safety!</p>
</body>
</html>
        `,
        });
      },
    );
  } else {
    callback(undefined, {
      statusCode: 200,
      body: "OK",
    });
  }
};

/**
 * Integration config for `yarn integration:advanced`
 */

module.exports = {
  "petstore-file": {
    file: "integration/petstore.yaml",
    output: "integration/petstoreFromFileSpecWithConfig.tsx",
  },
  "petstore-github": {
    github: "OAI:OpenAPI-Specification:master:examples/v3.0/petstore.yaml",
    output: "integration/petstoreFromGithubSpecWithConfig.tsx",
  },
};

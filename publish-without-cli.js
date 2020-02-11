/**
 * Script to produce a `-without-cli` restful-react version.
 *
 * This produce a very lightweight build, without the cli script,
 * this is for easier security auditing and projects that don't use
 * our amazing open-api generator.
 *
 * This is executed just after `yarn build`, so the `/dist` is present.
 */
const { readFileSync, writeFileSync } = require("fs");
const util = require("util");
const pick = require("lodash/pick");
const omit = require("lodash/omit");
const rimraf = util.promisify(require("rimraf"));

const restfulReactDeps = ["lodash", "lodash-es", "qs", "react-fast-compare", "url"];
const packageJSON = JSON.parse(readFileSync("package.json", "utf-8"));

// Dummy check to be sure we don't forgot a new package in the `-without-cli` version.
if (Object.keys(packageJSON.dependencies).length !== 16) {
  throw new Error("The number of dependencies has changed! Please update `publish-without-cli`");
}

// Create a package.json without the cli dependencies
const lightPackageJSON = omit(packageJSON, "bin", "scripts", "husky", "devDependencies");
lightPackageJSON.dependencies = pick(packageJSON.dependencies, ...restfulReactDeps);
lightPackageJSON.version = packageJSON.version + "-without-cli";

// Delete cli folders
Promise.all([rimraf("dist/bin"), rimraf("dist/scripts")]).then(() => {
  // Replace the package.json
  writeFileSync("package.json", JSON.stringify(lightPackageJSON, null, 2));

  // npm publish --tag without-cli
});

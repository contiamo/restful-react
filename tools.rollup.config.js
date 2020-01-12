import typescript from "rollup-plugin-typescript2";
import json from "@rollup/plugin-json";
import commonjs from "rollup-plugin-commonjs";
import readPkgUp from "read-pkg-up";
import path from "path";
import fs from "fs";

// Helper methods, from @kentcdodd's kcd-scripts
function parseEnv(name, def) {
  if (envIsSet(name)) {
    try {
      return JSON.parse(process.env[name]);
    } catch (err) {
      return process.env[name];
    }
  }
  return def;
}

function envIsSet(name) {
  return process.env.hasOwnProperty(name) && process.env[name] && process.env[name] !== "undefined";
}

const { packageJson: pkg, path: pkgPath } = readPkgUp.sync({
  cwd: fs.realpathSync(process.cwd()),
});
const appDirectory = path.dirname(pkgPath);
const fromRoot = (...p) => path.join(appDirectory, ...p);

// Check build specifics
const deps = Object.keys(pkg.dependencies || {});
const peerDeps = Object.keys(pkg.peerDependencies || {});
const defaultExternal = deps.concat(peerDeps);

function getUtilityConfig(name) {
  return {
    input: `src/bin/${name}.ts`,
    output: {
      name: name,
      file: `lib/${name}.js`,
      format: "cjs",
      banner: "#!/usr/bin/env node",
      exports: "named",
    },
    external: defaultExternal,
    plugins: [
      json(),
      commonjs({ include: "node_modules/**" }),
      typescript({
        rollupCommonJSResolveHack: true,
        exclude: "**/__tests__/**",
        clean: true,
        tsconfigOverride: {
          // Disable the creation type definitions for the tools scripts
          compilerOptions: {
            declaration: false,
            declarationMap: false,
          },
        },
      }),
    ],
  };
}

module.exports = [getUtilityConfig("restful-react-import"), getUtilityConfig("restful-react")];

import typescript from "rollup-plugin-typescript2";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-replace";
import nodeResolve from "rollup-plugin-node-resolve";
import nodeBuiltIns from "rollup-plugin-node-builtins";
import nodeGlobals from "rollup-plugin-node-globals";
import { terser } from "rollup-plugin-terser";
import { sizeSnapshot } from "rollup-plugin-size-snapshot";
import readPkgUp from "read-pkg-up";
import path from "path";
import glob from "glob";
import fs from "fs";
import camelcase from "lodash/camelCase";
import omit from "lodash/omit";

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
const capitalize = s => s[0].toUpperCase() + s.slice(1);

// Check build specifics
const minify = parseEnv("BUILD_MINIFY", false);
const format = process.env.BUILD_FORMAT;
const isNode = parseEnv("BUILD_NODE", false);
const name = process.env.BUILD_NAME || capitalize(camelcase(pkg.name));
const useSizeSnapshot = parseEnv("BUILD_SIZE_SNAPSHOT", false);

const esm = format === "esm";
const umd = format === "umd";

const defaultGlobals = Object.keys(pkg.peerDependencies || {}).reduce((deps, dep) => {
  deps[dep] = capitalize(camelcase(dep));
  return deps;
}, {});

const deps = Object.keys(pkg.dependencies || {});
const peerDeps = Object.keys(pkg.peerDependencies || {});
const defaultExternal = umd ? peerDeps : deps.concat(peerDeps);

const input = glob.sync(fromRoot(process.env.BUILD_INPUT || "src/index.tsx"));
const codeSplitting = input.length > 1;

const filenameSuffix = process.env.BUILD_FILENAME_SUFFIX || "";
const filenamePrefix = process.env.BUILD_FILENAME_PREFIX || "";
const globals = parseEnv("BUILD_GLOBALS", defaultGlobals);

const external = parseEnv("BUILD_EXTERNAL", defaultExternal).filter((e, i, arry) => arry.indexOf(e) === i);
const externalPattern = new RegExp(`^(${external.join("|")})($|/)`);

function externalPredicate(id) {
  const isDep = external.length > 0 && externalPattern.test(id);
  if (umd) {
    // for UMD, we want to bundle all non-peer deps
    return isDep;
  }
  // for esm/cjs we want to make all node_modules external
  // TODO: support bundledDependencies if someone needs it ever...
  const isNodeModule = id.includes("node_modules");
  const isRelative = id.startsWith(".");
  return isDep || (!isRelative && !path.isAbsolute(id)) || isNodeModule;
}

// Generate the name of exported file
const filename = [pkg.name, filenameSuffix, `.${format}`, minify ? ".min" : null, ".js"].filter(Boolean).join("");

const dirpath = path.join(...[filenamePrefix, "dist"].filter(Boolean));

const output = [
  {
    name,
    ...(codeSplitting ? { dir: path.join(dirpath, format) } : { file: path.join(dirpath, filename) }),
    format: esm ? "es" : format,
    exports: esm ? "named" : "named",
    globals,
  },
];

// Attempt to translate the typescript for node execution

const replacements = Object.entries(umd ? process.env : omit(process.env, ["NODE_ENV"])).reduce((acc, [key, value]) => {
  let val;
  if (value === "true" || value === "false" || Number.isInteger(+value)) {
    val = value;
  } else {
    val = JSON.stringify(value);
  }
  acc[`process.env.${key}`] = val;
  return acc;
}, {});

const config = {
  input: codeSplitting ? input : input[0],
  output,
  external: externalPredicate,
  plugins: [
    isNode ? nodeBuiltIns() : null,
    isNode ? nodeGlobals() : null,
    nodeResolve({
      preferBuiltins: isNode,
      mainFields: ["module", "main", "jsnext", "browser"],
    }),
    commonjs({ include: "node_modules/**" }),
    replace(replacements),
    useSizeSnapshot ? sizeSnapshot({ printInfo: false }) : null,
    minify ? terser() : null,
    typescript({
      rollupCommonJSResolveHack: true,
      exclude: "**/__tests__/**",
      clean: true,
    }),
    codeSplitting &&
      ((writes = 0) => ({
        generateBundle() {
          if (++writes !== input.length) {
            return;
          }

          input
            .filter(single => single.indexOf("index.tsx") === -1)
            .forEach(single => {
              const chunk = path.basename(single);

              writeExtraEntry(chunk.replace(/\..+$/, ""), {
                cjs: `${dirpath}/cjs/${chunk}`,
                esm: `${dirpath}/esm/${chunk}`,
              });
            });
        },
      }))(),
  ].filter(Boolean),
};

module.exports = config;

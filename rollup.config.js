import { resolve } from "path";
import typescript from "rollup-plugin-typescript2";

export default {
  input: resolve(__dirname, "src/index.tsx"),
  output: {
    file: resolve(__dirname, "dist/index.js"),
    format: "umd",
    name: "react-rest",
    globals: ["React"],
  },
  plugins: [typescript()],
  external: ["react"],
};

import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        land: resolve(__dirname, "land.html"),
      },
    },
  },
  plugins: [
    {
      name: "copy-classic-script",
      closeBundle() {
        mkdirSync(resolve(__dirname, "dist"), { recursive: true });
        copyFileSync(resolve(__dirname, "app.js"), resolve(__dirname, "dist/app.js"));
        copyFileSync(resolve(__dirname, "land.js"), resolve(__dirname, "dist/land.js"));
        copyFileSync(resolve(__dirname, "land.css"), resolve(__dirname, "dist/land.css"));
      },
    },
  ],
});

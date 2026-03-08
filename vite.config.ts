import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const __dirname = dirname(fileURLToPath(import.meta.url));
const setupDir = resolve(__dirname, "app/test/setup");

const base = process.env.GITHUB_PAGES ? "/sextant/" : "/";

export default defineConfig({
  base,
  plugins: [
    tailwindcss(), 
    !process.env.VITEST && mdx({
      remarkPlugins: [remarkGfm, remarkFrontmatter],
      rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
    }),
    !process.env.VITEST && reactRouter(), 
    tsconfigPaths()
  ],
  test: {
    // Default test configuration for fast unit tests
    // No jsdom environment - runs in Node environment
    // Exclude component tests and e2e tests from default run
    exclude: ['**/*.component.test.{ts,tsx}', '**/node_modules/**', '**/e2e/**'],
    setupFiles: [resolve(setupDir, "indexeddb.ts")],
  },
});

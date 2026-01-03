import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

export default defineConfig({
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
    // Exclude component tests from default run
    exclude: ['**/*.component.test.{ts,tsx}', '**/node_modules/**'],
    setupFiles: ['./app/test/setup/indexeddb.ts'],
  },
});

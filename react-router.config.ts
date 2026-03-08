import type { Config } from "@react-router/dev/config";

const base = process.env.GITHUB_PAGES ? "/sextant/" : "/";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
  // basename must start with the Vite `base` path (without trailing slash)
  basename: base.replace(/\/$/, "") || "/",
} satisfies Config;

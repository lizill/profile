import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

const base = process.env.PUBLIC_SITE_BASE_PATH ?? "/profile";
const site = process.env.PUBLIC_SITE_URL ?? "https://lizill.github.io";

export default defineConfig({
  site,
  base,
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});

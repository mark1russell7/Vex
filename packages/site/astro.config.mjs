// The site of Vex: the docs, the living spec and the Lab. GitHub Pages serves it at /vex/.
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const base = process.env.SITE_BASE ?? "/vex";

export default defineConfig({
  site: "https://mark1russell7.github.io",
  base,
  trailingSlash: "ignore",
  integrations: [
    starlight({
      title: "Vex",
      description: "Typed spreadsheet formulas over domain objects.",
      logo: { src: "./src/assets/mark.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/mark1russell7/vex" }],
      editLink: { baseUrl: "https://github.com/mark1russell7/vex/edit/main/packages/site/" },
      customCss: [
        "@fontsource-variable/atkinson-hyperlegible-next",
        "@fontsource-variable/atkinson-hyperlegible-mono",
        "./src/styles/tokens.css",
        "./src/styles/theme.css",
      ],
      components: { Hero: "./src/components/Hero.astro" },
      sidebar: [
        { label: "Learn", items: ["learn/tour", "learn/concepts", "learn/spreadsheet", "learn/sheets", "learn/axes", "learn/errors"] },
        { label: "Lab", items: ["lab"] },
        { label: "Spec", items: ["spec", "spec/regressions"] },
        { label: "Why none?", items: [{ autogenerate: { directory: "errors" } }] },
        { label: "Reference", items: ["reference/api", "reference/domains", "reference/ir"] },
        { label: "Gallery", items: ["gallery/layout", "gallery/grid", "gallery/life", "gallery/laws"] },
        { label: "Ideas", items: ["ideas/comonad", "ideas/lineage", "about"] },
      ],
    }),
    react(),
  ],
});

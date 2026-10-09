// The site of Vex: the docs, the living spec and the Lab. GitHub Pages serves it at /vex/.
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

const base = process.env.SITE_BASE ?? "/vex";
const site = "https://mark1russell7.github.io";
// The share card of each page (Open Graph and Twitter). scripts/og-image.mjs renders it.
const card = `${site}${base}/og.png`;

export default defineConfig({
  site,
  base,
  trailingSlash: "ignore",
  integrations: [
    starlight({
      title: "Vex",
      description: "Vex: typed spreadsheet formulas over TypeScript objects. One formula evaluated at each record, axes, sheets and trees, and an error value with a reason instead of an exception.",
      head: [
        { tag: "meta", attrs: { property: "og:image", content: card } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: "Vex: typed spreadsheet formulas over TypeScript objects. Boxes on graph paper with arrows to the nearest box." } },
        { tag: "meta", attrs: { name: "twitter:image", content: card } },
        { tag: "meta", attrs: { name: "theme-color", content: "#1f3fbf" } },
        { tag: "meta", attrs: { name: "keywords", content: "TypeScript, spreadsheet formulas, expression language, DSL, computed fields, rules engine, layout, declarative, functional programming, comonad, property-based testing" } },
      ],
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

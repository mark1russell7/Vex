<!-- ste-disable -->
> **Raw research report (2026-10-08).** Inventory: the lag docs site, the github.io site, the family design tokens, the widget pattern of a private tool. A research agent of the 2026-10-08 review wrote this report. It is kept verbatim as evidence. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# How lag's docs site and the personal site are built and deployed (read-only; nothing was changed)

Note that lag's working copy is on branch `experiment/e6-worker-output`. `git diff main..HEAD` shows no change under `packages/site` or `pages.yml`, so everything below also holds for `main`.

## Summary
- **lag's site** is `lag/packages/site`. It is a hand-built single-page app, not Astro, Starlight, VitePress or Docusaurus. The stack is Vite 7 + React 19 + MDX 3 + React Router 7.
  - Charts use Observable Plot, diagrams use Mermaid, and the node graph uses React Flow (`@xyflow/react`).
  - Fonts are self-hosted Atkinson Hyperlegible Next and Mono.
  - The lag repo deploys it with its own `pages.yml` to **https://mark1russell7.github.io/lag/**. It is live and the last run on `main` succeeded at 2026-10-08T15:23Z. There is no CNAME. The base path is the repo name, passed in `SITE_BASE`.
- **mark1russell7.github.io** is a separate user site at **https://mark1russell7.github.io/**. It is live but only a placeholder ("Portfolio under construction."), with 2 commits.
  - It is on a newer stack: Vite 8.3.3, TypeScript 7.0.2, Vitest 5.0.3, Node 26, pnpm 12.10.1.
  - It has **no design system** (no tokens, fonts or components). It does not embed or build lag. Its README only links to lag's site.
  - So lag's tokens are the only real "family" look.
- **lag has no `<!-- widget:x -->` markers.** It has two related mechanisms:
  - a remark plugin that turns ` ```mermaid ` code fences into a `<Mermaid>` component;
  - a README block between `<!-- metrics:start -->` and `<!-- metrics:end -->`, regenerated from the code's metric catalog and checked in CI.
- **The widget-marker system is in a private repository.** It renders markdown into one standalone HTML page that is published as a claude.ai Artifact, not to GitHub Pages.
- **The bar to beat.** lag runs the real library live in the page (the playground and a home-page "this tab" meter), has theme-aware charts and diagrams, an interactive architecture map, and a CI test-results explorer. It has **no** code editor or REPL, syntax highlighting, search, generated API docs, type hovers or animation.

## 1. lag site: stack and installed versions

| Dependency | Range in `package.json` | Installed |
|---|---|---|
| react / react-dom | ^19.3.0 | 19.3.0 |
| react-router | ^7.18.4 | 7.18.4 |
| vite / @vitejs/plugin-react | ^7.3.1 / ^5.2.0 | 7.3.1 / 5.2.0 |
| @mdx-js/rollup, @mdx-js/mdx | ^3.1.1 | 3.1.1 |
| remark-gfm, remark-frontmatter, remark-mdx-frontmatter, rehype-slug, rehype-autolink-headings, yaml | ^4.0.1, ^5.0.0, ^5.2.0, ^6.0.0, ^7.1.0, ^2.9.1 | — |
| @observablehq/plot | ^0.6.17 | 0.6.17 |
| mermaid | ^11.17.2 | 11.17.2 |
| @xyflow/react | ^12.12.0 | 12.12.0 |
| @fontsource-variable/atkinson-hyperlegible-next, -mono | ^5.3.0 | 5.3.0 |
| vitest, @vitest/browser(-playwright), playwright | ^4.1.2, ^4.1.2, ^1.58.2 | 4.1.2, 1.58.2 |
| Repo root | pnpm workspace `packages/*`, typescript ^5.9.3, tsx ^4.21.0 | CI uses pnpm 10 and Node 24 |

The tsconfig chain is `ts/config/react.json` → `vite.json` → … (a local copy of the cue presets).

## 2. File tree of `lag/packages/site`
```
index.html            # inline script sets the stored theme before first paint; <noscript>; /src/main.tsx
vite.config.ts        # MDX plugins, SITE_BASE, aliases to workspace src, worker format es
vitest.config.ts      # 2 projects: node, and browser (Playwright Chromium, headless)
public/favicon.svg    # brand mark; adapts to prefers-color-scheme
public/data/results/  # written by `pnpm results` (gitignored); read by the results viewer
build/                # Node-side plugins, each with a *.test.ts
  base.ts                   # normalizeBase(SITE_BASE)
  frontmatter.ts, frontmatter-plugin.ts   # page.mdx?frontmatter -> tiny module (eager)
  mdx-plugin.ts             # wraps @mdx-js/rollup + the remark/rehype chain
  rehype-export-toc.ts      # each page exports `toc` (h2/h3)
  remark-mermaid.ts         # ```mermaid title="" caption=""  ->  <Mermaid chart=…>
  spa-fallback-plugin.ts, static-routes.ts  # one HTML file per route + 404.html after build
content/              # 49 MDX pages (docs 39, research 9, thesis 1), ~9.4k lines, plus *.data.ts sidecars
  docs/{index,getting-started,architecture,api}.mdx, concepts/(8), monitors/(21), operations/(3), testing/(1), contributing/(2)
  research/(9)  thesis/index.mdx
src/
  main.tsx            # imports fonts and global.css; createBrowserRouter(routes, {basename})
  adapters/           # lag-core.ts, lag-load.ts, lag-report.ts: the ONLY files that import @lag/*
  app/                # routes.tsx, sections.tsx (nav + routes + home cards from one array), RootLayout
                      # (skip link, screen-reader route announcer, ScrollRestoration), SiteHeader/Footer,
                      # BrandMark, NotFoundPage, RouteError, SiteProviders, default-services, smoke.browser.test.tsx
  architecture/graph.ts   # node/edge data for the ArchitectureMap
  components/         # ArchitectureMap, Callout, DataTable, ErrorBoundary, Figure, MdxLink, Mermaid, MetricTable,
                      # PlotFigure, ScrollTable, StatusIcon, SupportMatrix, Tabs (each .tsx + .module.css)
  content/            # glob-source, registry (pages, sidebar, prev/next), frontmatter checks, ContentRoute,
                      # ContentPageView, SectionSidebar, TableOfContents, PageFooter
  home/               # HomePage, MainThreadIndicator (live), card details
  lib/                # cx, format, stats, use-async, use-element-width, use-media-query, memoize-promise, InlineCode
  mdx/                # component-map.tsx (components usable in MDX without import), MdxComponentsContext
  playground/         # PlaygroundSession, LiveMeter, RingBuffer, use-session, LiveChart, LoadPanel, StatePanel, catalog
  results/            # CI results explorer (~2.6k lines): model/, views/, components/, charts.ts, report-source.ts
  styles/tokens.css, global.css
  theme/              # ThemeProvider, ThemeToggle, theme.ts, preferences.ts, colors.ts (CSS variables -> JS values)
```

## 3. How pages are written
- **MDX** files live in `content/<section>/…`.
  - The frontmatter is `title`, `description`, `order`, and an optional `status: draft|final`. A runtime check (`parsePageMeta`) and `content.test.ts` validate it. A draft page shows a note callout.
  - The h1 comes from the frontmatter, so page text starts at h2.
- **Components need no import** (`lag/packages/site/src/mdx/component-map.tsx`):
  - `a` → MdxLink: site paths become router links.
  - `table` → MarkdownTable: wide tables scroll sideways.
  - `ArchitectureMap` (lazy), `Callout`, `Figure`, `Mermaid`, `MetricTable`, `PlotFigure`, `SupportMatrix`, `Tab`, `Tabs`.
  - Usage counts across the pages: MetricTable 26, Callout 17, Mermaid 13 as JSX plus 4 fences, SupportMatrix 7, Tabs 2, PlotFigure 2, ArchitectureMap 1.
- **Data sidecars.** The only real imports in the MDX pages are `*.data.ts` files next to them. These compute chart options and tables from the library:
  - `content/docs/monitors/metrics.data.ts` builds rows from `METRIC_CATALOG`;
  - `content/docs/testing/strategy.data.ts` samples the "heavy" profile of `@lag/load` with seed 42 into a Plot box chart and a table;
  - `content/docs/concepts/diagrams.data.ts` holds the Mermaid source strings.
- **Code samples** are plain fenced `<pre><code>` blocks. They have no highlighting and no copy button, and they are not live.
- **Loading.** Each page's frontmatter loads eagerly through a `?frontmatter` virtual module. Each page body is a lazy chunk (`import.meta.glob`), read with React 19 `use()` and Suspense. Components render `<title>` and `<meta>` themselves (React 19 hoists them).
- **Navigation.** The sidebar groups pages by their first folder. Each page has an "On this page" table of contents and previous/next links. The footer says "To change this page, edit `<sourcePath>`"; there is no GitHub edit link.
- **The MDX chain** (`build/mdx-plugin.ts`):
```ts
remarkPlugins : [ remarkFrontmatter, [remarkMdxFrontmatter, { name : "frontmatter" }], remarkGfm, remarkMermaid ],
rehypePlugins : [ rehypeSlug, rehypeExportToc, [rehypeAutolinkHeadings, { behavior : "wrap", properties : { className : ["heading-anchor"] } }] ],
```

## 4. How the library's real code gets into the page
`lag/packages/site/vite.config.ts`, verbatim:
```ts
const siteDir = fileURLToPath(new URL(".", import.meta.url));
/** The `src` folder of a workspace package, so the site always uses the current source. */
function sourceOf(packageDir : string) : string { return path.resolve(siteDir, "..", packageDir, "src"); }
export default defineConfig({
    // Set SITE_BASE to deploy below a path, as GitHub Pages does: SITE_BASE=lag
    // gives /lag/. (Git Bash on Windows changes "/lag" into a Windows path, so
    // there use the form without slashes.)
    base : normalizeBase(process.env["SITE_BASE"]),
    plugins : [ mdxFrontmatterPlugin(), mdxPlugin(), react({ include : /\.(mdx|js|jsx|ts|tsx)$/ }), spaFallbackPlugin() ],
    resolve : { alias : {
        "@lag/core" : sourceOf("lag"), "@lag/worker" : sourceOf("lag-worker"),
        "@lag/load" : sourceOf("load"), "@lag/report" : sourceOf("report") } },
    worker : { format : "es" },
    optimizeDeps : { include : [ "react","react-dom","react-dom/client","react-router","react-router/dom","@observablehq/plot","@xyflow/react","mermaid" ] },
    build : { target : "es2022", chunkSizeWarningLimit : 1500 },   // Mermaid is large; lazy
});
```
- **One adapter layer.** Only `src/adapters/lag-core.ts`, `lag-load.ts` and `lag-report.ts` import library packages. Their comment says: "When the API of the core changes, update this file and nothing else."
- **Lazy loading.** `browserSessionFactory = (kind) => import("../playground/browser-session").then(...)` is provided through React context. The library code only downloads when a page starts a session. Plot, Mermaid and React Flow are also lazy.
- **Web Worker.** `@lag/worker` does `new Worker(new URL("./bundled-worker.js", import.meta.url), { type: "module" })`, which is the standard Vite worker pattern.
- **Live data path.**
  1. `LiveMeter` implements the library's own `Meter` port, keeping samples in ring buffers.
  2. A framework-free `PlaygroundSession` class makes snapshots.
  3. React reads them with `useSyncExternalStore`.
  4. Tests swap in fakes.

## 5. Interactive features (the bar to beat)
All paths are under `lag/packages/site/src/`.

| Feature | Path | What it does and how |
|---|---|---|
| Live playground (`/playground`) | `playground/PlaygroundPage.tsx`, `session.ts`, `live-meter.ts`, `browser-session.ts`, `LoadPanel.tsx`, `LiveChart.tsx`, `StatePanel.tsx`, `catalog.ts` | Starts the real `@lag/core` monitors (`setupAllMonitors(createBrowserDeps(window, …))`) and a real worker in the page. It has 8 load buttons (busy-block for 50/200/800 ms, layout thrash, garbage, long animation frame, macrotask and microtask floods) and 6 seeded workload profiles from `@lag/load`. Four live Observable Plot charts update every 500 ms over a 30 s window: drift, main-thread block seen by the worker, frame delta, event duration. A panel shows counters, the page lifecycle state and a monitor log. |
| "This tab" live meter (home page) | `home/MainThreadIndicator.tsx` | A lazy timers-only session shows the p95 timer drift as a big number and a 10 s spike chart; bars of 50 ms or more are red. With reduced motion it does not start until clicked. |
| Interactive architecture map | `components/ArchitectureMap/ArchitectureMap.tsx` + `architecture/graph.ts` | React Flow with fixed positions. You can select a box by click or keyboard; a side panel shows the description, outgoing arrows and a docs link. Zoom controls; a "show as list" fallback. |
| Theme-aware Mermaid diagrams | `components/Mermaid/Mermaid.tsx` + `build/remark-mermaid.ts` | Lazy-loaded with the `base` theme mapped from the site tokens; it re-renders on theme change. The source text is behind a disclosure. A fence like ` ```mermaid title="…" caption="…" ` becomes the component. |
| Chart wrapper | `components/PlotFigure/PlotFigure.tsx` | Loads Plot lazily, sizes the chart to its container, takes the theme colors, and always offers a data-table disclosure (`DataTable`). Doc charts are computed from the library itself. |
| CI test-results explorer (`/results`) | `results/views/*` (RunListPage, RunOverview, TestsView, CoverageView, MutationView, BudgetsView, MeasurementsView), `results/charts.ts` | Reads `public/data/results/index.json` and `runs/*.json` made by `pnpm results`. Shows trends over runs, a package × environment matrix, failures, slowest tests, duration histograms, coverage, mutation scores, budgets, and histograms/ECDF/percentiles of measurements. Filters live in the URL; tables sort. |
| Tables built from the code's catalog | `components/MetricTable`, `components/SupportMatrix` | Metric rows come from `METRIC_CATALOG`. The browser-support matrix uses shape icons and footnotes. |
| Tabs, callouts, theme toggle | `components/Tabs`, `components/Callout`, `theme/ThemeToggle.tsx` | Tabs follow the WAI-ARIA pattern. Callouts use the STE labels Note/Warning/Caution, each with its own shape. The theme toggle cycles system → light → dark. |

Accessibility is a house convention:
- every chart has a data table, every diagram has its source, and the map has a list;
- a skip link and a screen-reader route announcer;
- a global reduced-motion rule and status icons that do not rely on color.

The locally saved screenshot `lag/.playwright-mcp/architecture-map.png` (gitignored) shows the look: hairline grey boxes, blue links, no shadows.

## 6. Theming, search, API reference
- **Light and dark.**
  - An inline script in `index.html` applies `localStorage["lag-site:theme"]` before first paint, setting `data-theme` on `<html>`.
  - `ThemeProvider` uses `useSyncExternalStore` on `prefers-color-scheme`.
  - `theme/colors.ts` reads the CSS variables with `getComputedStyle`, so Plot, Mermaid and React Flow get real color values.
- **Search: none.**
  - The only search box is the test filter in the results viewer.
  - The per-route HTML files the build writes contain only the title and description; the body is client-rendered.
  - So a static indexer such as Pagefind would find no content without prerendering.
- **API reference: hand-written.** `content/docs/api.mdx` (marked `status: draft`) has markdown tables. Metric tables come from the catalog. There is no TypeDoc, no twoslash and no syntax highlighter in the dependencies.

## 7. Build and deploy
`lag/.github/workflows/pages.yml`, verbatim:
```yaml
# Builds the website (packages/site) with the newest test results and
# publishes it to GitHub Pages. To use this workflow, set the Pages source of
# the repository to "GitHub Actions" (Settings > Pages).
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write
  # To download the newest report of the mutation workflow
  actions: read

# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  # The browser tests in the real Safari. Only macOS has Safari. The job
  # exports its reports, and the build job adds them to the run of the site.
  safari:
    runs-on: macos-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Enable safaridriver
        run: sudo safaridriver --enable
      # App Nap of macOS slows the timers of a window that is not in front: a CI runner
      # slowed the timers of Safari by 9 s one time
      - name: Turn off App Nap
        run: |
          defaults write com.apple.Safari NSAppSleepDisabled -bool YES
          defaults write NSGlobalDomain NSAppSleepDisabled -bool YES
      - name: Test in Safari
        continue-on-error: true
        # caffeinate keeps the display awake: WebKit slows the timers of a window that it does not show
        run: |
          caffeinate -dimsu -t 3600 &
          pnpm results --skip-unit --skip-browser --skip-overhead --skip-site --no-mutation --safari --export-reports=safari-reports
      - uses: actions/upload-artifact@v4
        with:
          name: safari-reports
          path: safari-reports/
          if-no-files-found: ignore

  build:
    # The site also builds when the Safari job fails
    needs: safari
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Install the Playwright browsers
        run: pnpm --filter @lag/integration-tests exec playwright install --with-deps chromium firefox webkit

      # The weekly mutation workflow uploads its report. pnpm results reads the newest one.
      - name: Download the newest mutation report
        continue-on-error: true
        env:
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          run_id=$(gh run list --workflow mutation.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')
          if [ -n "$run_id" ]; then
            gh run download "$run_id" --name mutation-report --dir packages/lag/reports/mutation
          fi

      - name: Download the Safari reports
        continue-on-error: true
        uses: actions/download-artifact@v4
        with:
          name: safari-reports
          path: safari-reports

      # The results viewer of the site reads packages/site/public/data/results
      - name: Make the test results
        run: pnpm results --import-reports=safari-reports
        continue-on-error: true

      - name: Build the site
        run: pnpm --filter @lag/site build
        env:
          SITE_BASE: ${{ github.event.repository.name }}

      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
- **Base path.** `SITE_BASE` (the repo name) goes through `normalizeBase` to `/lag/`. The router uses `basename: routerBasename(import.meta.env.BASE_URL)`.
- **Routing on Pages.** After the build, `spaFallbackPlugin` copies `index.html` to `404.html`. It also writes `<route>.html` and `<route>/index.html` for every MDX page, every results run and view, and `playground`, each with its title and description.
- **Pages settings** (from `gh api`): `build_type: workflow`, `cname: null`, `https_enforced: true`.
- **CI gate.** The `site` job in `ci.yml` installs Chromium, then runs typecheck, test and build. The tests include a smoke test that renders every route and fails on any `console.error` or unhandled rejection, and a real-monitor browser test.
- **Other CI gates.** `pnpm lint:ste` (ASD-STE100 Simplified Technical English rules over the README, site MDX and doc comments) and `pnpm readme:metrics:check`.

## 8. How lag's docs are organized beyond the site
- There is no top-level `docs/` folder, although `ste.config.json` lists `docs/**`. The site's `content/` folder is the documentation, plus the root and package READMEs.
- The only doc generator is `lag/packages/scripts/src/readme-metrics.ts`. It writes the markdown metric table between `<!-- metrics:start -->` and `<!-- metrics:end -->` in the README from `METRIC_CATALOG`; `--check` fails CI if they differ.
- `pnpm results` (`packages/scripts/src/results/collect.ts`) gathers Vitest, Istanbul and Stryker results into `@lag/report` JSON for the site.
- The site footer carries an AI-authorship disclosure, and the writing style is STE. Both are family conventions; the github.io README and CLAUDE.md say the same.

## 9. mark1russell7.github.io
- **Files.** `packages/site/{index.html, vite.config.ts, vitest.config.ts, tsconfig.json, src/main.tsx, src/App.tsx}` and `packages/cli`. These came from the `template` repo, whose generator is `pnpm package add <name> --preset=react`.
  - `App.tsx` renders `<h1>Mark Russell</h1><p>Portfolio under construction.</p>`.
  - There is no CSS, no fonts and no tokens.
  - The `vite.config.ts` comment: "A user site (<user>.github.io) is served from the domain root, so the default base "/" is right."
- **Relationship to project sites.** These are two independent Pages deployments on the same host. The user-site repo serves `/`. Each project repo deploys its own `/<repo>/` with its own workflow. The README says: "The project sites of other repositories are on the same domain, for example [lag](https://mark1russell7.github.io/lag/)." Nothing is embedded, proxied or built across repos.
- **Its `pages.yml`, verbatim.** It uses newer action versions than lag:
```yaml
# Builds packages/site and publishes it to GitHub Pages at https://mark1russell7.github.io/.
# To use this workflow, set the Pages source of the repository to "GitHub Actions"
# (Settings > Pages).
name: Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
# One deployment at a time. A newer push cancels a deployment that waits.
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @portfolio/site build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: packages/site/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```
  Its `ci.yml` runs typecheck, test, build and `pnpm lint:ste`.
- **Installed versions:** React 19.3.0, Vite 8.3.3, @vitejs/plugin-react 6.1.2, Vitest 5.0.3, TypeScript 7.0.2.

## 10. Design tokens for the family look
These are lag's, from `lag/packages/site/src/styles/tokens.css`. The file's own description: "ink on graph paper. Hairlines, no shadows, no gradients. Blue ink for links and focus. Red pencil marks the time that the main thread loses."

```css
:root {
    --color-page: #f5f6f9;  --color-surface: #ffffff;  --color-surface-sunken: #eef1f6;
    --color-ink: #151c2e;   --color-ink-secondary: #454f67;  --color-ink-muted: #5f6880;
    --color-rule: #d6dbe5;  --color-rule-strong: #aeb6c7;  --color-control-border: #7a8399;  --color-grid: #e7eaf1;
    --color-accent: #2346c4; --color-accent-strong: #172f8f; --color-accent-wash: #e7ecfd;
    --color-mark: #c2301f;  --color-mark-wash: #fbe9e6;
    --status-good: #0ca30c; --status-good-ink: #006300; --status-warning: #fab219; --status-warning-ink: #7a5200;
    --status-critical: #d03b3b; --status-critical-ink: #a3262a; --status-neutral: #8a91a3;
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
    --series-5: #e87ba4; --series-6: #008300; --series-7: #4a3aa7; --series-8: #e34948;
    --chart-grid: #e6e9f0; --chart-axis: #9aa1b3;
    --font-sans: "Atkinson Hyperlegible Next Variable", "Atkinson Hyperlegible Next", system-ui, sans-serif;
    --font-mono: "Atkinson Hyperlegible Mono Variable", "Atkinson Hyperlegible Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
    --text-xs: 0.8125rem; --text-sm: 0.9375rem; --text-base: 1.0625rem; /* 17px base */
    --text-lg: 1.25rem; --text-xl: 1.5rem; --text-2xl: 2rem; --text-3xl: 2.75rem;
    --space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem; --space-5: 1.5rem;
    --space-6: 2rem; --space-7: 2.5rem; --space-8: 3rem; --space-10: 4rem;
    --radius: 6px; --radius-small: 3px; --measure: 68ch; --page-width: 82rem;
    --header-height: 3.5rem; --gutter: clamp(1rem, 3vw, 2rem);
}
:root[data-theme="dark"] {   /* repeated under @media (prefers-color-scheme: dark) :root:not([data-theme="light"]) */
    --color-page: #0e1220; --color-surface: #151a2b; --color-surface-sunken: #1c2236;
    --color-ink: #e6e9f3; --color-ink-secondary: #b3bad0; --color-ink-muted: #949cb3;
    --color-rule: #2b3350; --color-rule-strong: #46507a; --color-control-border: #6f7aa3; --color-grid: #1b2134;
    --color-accent: #93abff; --color-accent-strong: #bccbff; --color-accent-wash: #1f2a4f;
    --color-mark: #ff7b6b; --color-mark-wash: #3a1f22;
    --status-good-ink: #4cc94c; --status-warning-ink: #fab219; --status-critical-ink: #ff8a8a;
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
    --chart-grid: #232a40; --chart-axis: #5d6683;
}
```
Signature details in `global.css` and the module CSS files:
- `.graph-paper`: a 16px grid of `--color-grid` lines on `--color-surface`.
- The sticky header is `color-mix(in srgb, var(--color-page) 92%, transparent)` with `backdrop-filter: blur(6px)`.
- Cards have `border-top: 3px solid var(--color-ink)` and radius `0 0 6px 6px`.
- Buttons use `[data-variant="primary"]` with the accent fill.
- A global `prefers-reduced-motion` rule stops animations.
- The brand mark (`app/BrandMark.tsx`) is 5 frame ticks with one tall red "lost frame" tick.

For contrast, the crawler page of a private tool is a different look:
- a teal accent: `--accent: #0e766d`, `--bg: #f6f7f5`;
- fonts from Google Fonts: Barlow Condensed for display, Public Sans for body, JetBrains Mono for code.

## 11. The widget-marker pattern of a private tool

*This section described a private repository. The public copy of this report leaves out its details.*

## 12. Live URLs and screenshots
- lag: **https://mark1russell7.github.io/lag/**. It is live, but **not linked** from lag's README, and the repo's `homepage` field is empty.
- The personal site: **https://mark1russell7.github.io/**. It is live, a placeholder, and its README links to the lag site.
- Vex: Pages is **not enabled** (`gh api repos/mark1russell7/Vex/pages` returns 404). The repo is public and has no `.github/`.
- No README in these repos has screenshots. Local, gitignored captures exist at `lag/.playwright-mcp/architecture.png` and `architecture-map.png`.

## 13. Things in the Vex repo that affect the plan
- **Repo shape.** Vex is one npm package (`package-lock.json`, vitest ^3.2.4), not a pnpm workspace.
  - The root `tsconfig.json` has `"include": ["./"]` and `rootDir: "./"`, so a site folder would be swept into the root type-check unless it is excluded.
- **Source is browser-safe.** There are no Node built-in imports; the `require(` hits are `LocalMap.require` DSL methods. So lag's alias-to-source approach works: Vite can compile the DSL directly.
- **Submodules are required.** The DSL depends on `external/Funk` (`external/Funk/optional/optional`) and `external/concat-src`. Both are public, so the Pages workflow needs `submodules: recursive`.
  - The committed `.gitmodules` uses the SSH alias `git@github.com-personal:` for concat-src, which no CI runner can resolve. The uncommitted working-copy change to `git@github.com:` fixes that part.
  - Whether `actions/checkout` fetches SSH-form public submodules with its token is unverified. Switching to `https://` URLs is the safe choice.
- **Base path.** The repo is named `Vex`, so `SITE_BASE: ${{ github.event.repository.name }}` gives `/Vex/`. Check how the capital letter behaves on Pages, or hard-code the base.
- **Scaffolding rule.** The workspace `CLAUDE.md` forbids hand-creating `package.json`, `src` folders or tsconfig files. It says to use `node cli/dist/index.js lib new` (the CLI at `cli/dist/index.js` exists) and `cue-config`. Template-derived repos instead use `pnpm package add <name> --preset=react`. A decision is needed on how to scaffold the Vex site package.
- **Writing style.** The Vex README is a spec that does not follow STE ("e.g.", em-dashes). If the site follows the family's STE and ste-lint convention, the text will need rewriting, or the lint scope must exclude it.

## 14. What can be reused and what must be built

**Reusable almost as-is** (copy, rename `lag` to `vex`, drop the results-specific parts):
- **Build plugins:** `build/base.ts`, `frontmatter*.ts`, `mdx-plugin.ts`, `rehype-export-toc.ts`, `remark-mermaid.ts` (also the template for widget fences), `spa-fallback-plugin.ts`, `static-routes.ts` (drop `resultsRoutes`).
- **App shell:** `main.tsx`, `routes.tsx`, the data-driven `sections.tsx`, `RootLayout` (skip link and route announcer), `SiteHeader`/`SiteFooter`, `NotFoundPage`, `RouteError`, `ErrorBoundary`.
- **Content system:** `src/content/*` (glob registry, frontmatter checks, sidebar, table of contents, previous/next).
- **Theme:** `tokens.css`, `global.css`, `theme/*`, and the no-flash script in `index.html`.
- **Components:** Callout, Tabs, Figure, MdxLink, ScrollTable/MarkdownTable, DataTable, PlotFigure, Mermaid, ArchitectureMap (+ `graph.ts`), StatusIcon.
- **Pattern to copy:** the playground architecture. A headless session class, an adapter implementing the library's port, `useSyncExternalStore`, a lazy factory provided through context, and fakes in tests.
- **Tests:** `smoke.browser.test.tsx` (render every route, fail on console errors) and `content.test.ts`.
- **Workflows:** `pages.yml` reduced to checkout (+ submodules), install, build with `SITE_BASE`, upload, deploy. Drop the Safari, mutation and results steps. Plus the `site` job from `ci.yml`.

**Specific to lag** (drop or replace): `results/` and `@lag/report`, `MainThreadIndicator`, `LiveChart`/`LoadPanel`/`StatePanel`, the load and monitor adapters, `MetricTable` and `SupportMatrix` content.

**Must be built new** (lag has nothing like these):
1. A live code editor (CodeMirror 6 or Monaco), in-browser TypeScript-to-JavaScript compiling (esbuild-wasm, sucrase, or `ts.transpileModule` in a worker), sandboxed running of Vex chains, and display of `Optional` results.
2. Type-aware hovers or twoslash, and syntax highlighting (for example Shiki as a rehype plugin). lag has neither.
3. Search. It must be built from the MDX source at build time, or the pages must be prerendered, because the route HTML shells are empty.
4. Generated API reference (TypeDoc JSON or ts-morph into React pages). lag writes its API page by hand.
5. Visualizations specific to the DSL: chain → IR steps → fold, the some/none paths of `Optional`, traversal axes over matrices, monoid aggregation, a law checker. Also motion. lag's style rules out decoration ("no shadows, no gradients"), so animation would be a deliberate extension of the family look.
6. Vex repo plumbing: a workspace or nested package, the tsconfig exclude, submodule checkout in CI, and turning Pages on (Settings > Pages > GitHub Actions).

**Version choice.**
- Matching the newest template stack (Vite 8, TypeScript 7, Vitest 5, Node 26, pnpm 12, checkout@v7, upload-pages-artifact@v5, deploy-pages@v5) keeps Vex in line with the personal site.
- But lag's MDX, Plot, Mermaid and xyflow setup is only proven on Vite 7.3.1 and TypeScript 5.9.3.
- Two compatibility checks are needed:
  - `@mdx-js/rollup` 3.1.1 under Vite 8;
  - any tool that needs the TypeScript JavaScript API (twoslash, TypeDoc, ts-morph, Monaco's TS worker) next to TypeScript 7. Such tools may need their own `typescript@5` dependency.

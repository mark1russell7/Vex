<!-- ste-disable -->
> **Raw research report (2026-10-08).** Inventory: the template monorepo, new-repo.ps1, lag, ste-lint, github.io, Funk. A research agent of the 2026-10-08 review wrote this report. It is kept verbatim as evidence. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# Inventory of the standard monorepo (template), lag, ste-lint, github.io, and Funk/concat-src

I changed no repo files. Everything was a read, plus `pnpm -v`, `npm view`, `git ls-remote`, GitHub API reads, `tsc --noEmit` without incremental output, and `ste-lint` run against Vex (it only writes to stdout). I ran one two-file tsc test in my scratchpad and deleted it afterwards. Vex's `git status` is the same as at the start (`M .gitmodules`, `?? docs/`).

## 0. These repos changed while I was reading them

Another session is rolling ste-lint out today, 2026-10-08. Times are EDT:

| Time | Repo | Commit | Change |
|---|---|---|---|
| 11:57 | template | `e5dbf5d` | Every dependency updated (pnpm 12, TS 7, vitest 5); package generator fixed |
| 11:59 | github.io | `9085392` | Repo created from the template |
| 12:13 | ste-lint | `35b6159` | Moved out of lag as `@mark1russell7/ste-lint`. It had a `prepare` build, so consumers needed a build approval |
| 12:15 | github.io | `ef65e96` | ste-lint added, with an `allowBuilds` approval |
| 12:33 | lag, branch `chore/shared-ste-lint` | `751a9c1` | Switched to the shared package, with an `onlyBuiltDependencies` approval |
| 12:43 | ste-lint | `f597d6c` | `dist/` committed and `prepare` removed. **No install approval is needed any more** |
| 13:00 | lag branch | `3b5dc54` | Approval removed |
| 13:03 | github.io | `c618739` | Approval removed |
| 13:06 | template | `d59e2aa` | "Add the STE writing rules: ste-lint, CLAUDE.md and CI" (pushed) |

Everything below is the state at 13:14. Run `git log -3` in template, lag and ste-lint again before you carry out the plan.

## (a) Template (`template`, origin `git@github.com:mark1russell7/template.git`)

### History
```
d59e2aa 2026-10-08 13:06 Add the STE writing rules: ste-lint, CLAUDE.md and CI   (= remote HEAD)
e5dbf5d 2026-10-08 11:57 Update every dependency to its newest version, and fix the package generator
7d77a66 2026-05-25 18:16 initial commit
```

### Tracked files (18 in total)
```
.gitattributes  .gitignore  .github/workflows/ci.yml  CLAUDE.md  package.json  pnpm-lock.yaml  pnpm-workspace.yaml  ste.config.json
packages/cli/{package.json, tsconfig.json, vitest.config.ts}
packages/cli/src/{index.ts, paths.ts, commands/index.ts, commands/package/{index,add}.ts, commands/repo/{index,rename}.ts}
```
- **Local but gitignored:** `.mcp.json` (MCP servers filesystem, memory and motherduck, with data in `./_db/`), `.claude/settings.local.json`, and `packages/cli/dist/.tsbuildinfo`. That last file appears because `tsc --noEmit` still writes it when cue turns on `incremental`.
- **Not in the template at all:**
  - README
  - root tsconfig or project references
  - ESLint, Prettier or Biome
  - `.editorconfig`, `.npmrc`, `.nvmrc`
  - git hooks (husky, lint-staged, lefthook, simple-git-hooks)
  - pnpm catalogs
  - root vitest workspace or projects, and coverage config
  - publish or release tooling
  - a site or docs app
- The only linter is ste-lint, and it checks prose, not code.

### Root `package.json` (verbatim)
```json
{
  "$schema": "https://json.schemastore.org/package",
  "name": "template-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.10.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "package": "tsx packages/cli/src/index.ts package",
    "template": "tsx packages/cli/src/index.ts repo",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint:ste": "ste-lint"
  },
  "devDependencies": {
    "@mark1russell7/cue": "github:mark1russell7/cue",
    "@mark1russell7/ste-lint": "github:mark1russell7/ste-lint",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```
Versions in the lockfile: typescript 7.0.2, tsx 4.23.15, vitest 5.0.3, vite 8.3.3 (through vitest), esbuild 0.28.2, @types/node 26.6.4, @clack/prompts 1.8.1. ste-lint is pinned at `codeload…/ste-lint/tar.gz/f597d6c…`, and ste-lint brings in typescript 6.0.3 for itself.

### `pnpm-workspace.yaml` (verbatim; no catalogs)
```yaml
packages:
  - "packages/*"

# Packages allowed to run install scripts. Since pnpm 11 every other package that has one fails the install.
# A git-hosted package is approved by its repository URL, so a new commit of cue needs no new approval.
allowBuilds:
  "@mark1russell7/cue@git+https://github.com/mark1russell7/cue.git": true
  esbuild: true
```
cue still needs this approval. Its `prepare` script runs `npm run build`, and only `dist/cli.*` is committed in cue.

### TypeScript: no root tsconfig; each package extends a cue preset
cue comes from `github:mark1russell7/cue`. Its HEAD is `fb96d13`, dated 2026-02-18, and it is not on npm.

**Preset chain:**
- `node.json` extends `ts.json`. **`node.json` does not set `types`.**
- `ts.json` extends `["./esm.json", "./lib.json"]`.
- `esm.json` extends `base.json` and adds `"module": "nodenext", "moduleResolution": "nodenext", "verbatimModuleSyntax": true`.
- `vite.json` extends `ts.json` and adds `lib ["esnext","dom","dom.iterable"]`, `module esnext`, `moduleResolution bundler`, `types ["vite/client"]`.
- `react.json` extends `vite.json` and adds `"jsx": "react-jsx"`.
- `node-cjs.json` extends `["./cjs.json","./lib.json"]`.

**`base.json` `compilerOptions`:**
- `target esnext`, `lib ["esnext"]`
- `declaration`, `declarationMap`, `removeComments false`, `importHelpers`, `sourceMap`
- `esModuleInterop`, `allowSyntheticDefaultImports`, `forceConsistentCasingInFileNames`, `isolatedModules`, **`isolatedDeclarations`**
- `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUncheckedSideEffectImports`, **`noUncheckedIndexedAccess`**, `noImplicitOverride`, `allowUnusedLabels false`, `allowUnreachableCode false`
- **`exactOptionalPropertyTypes`**, **`noPropertyAccessFromIndexSignature`**
- `moduleDetection force`, `newLine lf`, `stripInternal`
- `skipDefaultLibCheck false`, `skipLibCheck true`
- **`composite true`**, **`incremental true`**
- `pretty`, **`diagnostics true`**
- `noEmitOnError`, `resolveJsonModule`

**`lib.json` (verbatim):**
```json
"compilerOptions": { "outDir": "${configDir}/dist", "rootDir": "${configDir}/src", "tsBuildInfoFile": "${configDir}/dist/.tsbuildinfo" },
"include": ["${configDir}/src/**/*"],
"exclude": ["${configDir}/node_modules","${configDir}/dist","${configDir}/**/*.spec.ts","${configDir}/**/*.test.ts"]
```

### `packages/cli`
`package.json`:
```json
{ "$schema": "https://json.schemastore.org/package", "name": "@template/cli", "version": "0.1.0", "private": true, "type": "module",
  "main": "./src/index.ts", "bin": { "template": "./src/index.ts" },
  "scripts": { "test": "vitest run", "test:watch": "vitest", "typecheck": "tsc --noEmit" },
  "dependencies": { "@clack/prompts": "^1.8.1" },
  "devDependencies": { "@mark1russell7/cue": "github:mark1russell7/cue", "@types/node": "^26.6.4", "typescript": "^7.0.2", "vitest": "^5.0.3" } }
```
`tsconfig.json`:
```json
{ "$schema": "https://json.schemastore.org/tsconfig", "extends": "@mark1russell7/cue/ts/config/node.json",
  "compilerOptions": { "types": ["node"], "noEmit": true, "allowImportingTsExtensions": true }, "include": ["src/**/*"] }
```
`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.{test,spec}.ts"], passWithNoTests: true } });
```
The package has no tests. Its source imports relative files with `.ts` extensions, for example `./commands/index.ts`.

### Commands
- **`pnpm package add [<name>] [--preset=node|node-cjs|ts|vite|react]`**
  - Prompts with @clack when arguments are missing. The default preset is `node`.
  - Names must match `^[a-z0-9][a-z0-9-]*$`.
  - The scope is the root package name without `-monorepo`.
- **`pnpm template rename [<scope>] [--dry-run] [--reinit-git] [--force]`**
  - Rewrites `"<old>-monorepo"` and `@<old>/` in the root `package.json` and every `packages/*/package.json`.
  - Also rewrites `packages/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs}`.
  - Refuses unless the current scope is `template` or you pass `--force`.

### What `pnpm package add foo --preset=node` writes
- `packages/foo/package.json`:
  ```json
  {"$schema":"https://json.schemastore.org/package","name":"@<scope>/foo","version":"0.1.0","private":true,"type":"module",
   "main":"./src/index.ts","scripts":{"test":"vitest run","test:watch":"vitest","typecheck":"tsc --noEmit"},
   "devDependencies":{"@mark1russell7/cue":"github:mark1russell7/cue","@types/node":"^26.6.4","typescript":"^7.0.2","vitest":"^5.0.3"}}
  ```
  The devDependency versions are copied from `packages/cli/package.json` at the moment you run it.
- `packages/foo/tsconfig.json`: `{"$schema":"https://json.schemastore.org/tsconfig","extends":"@mark1russell7/cue/ts/config/node.json"}`. It has no overrides.
- `packages/foo/src/index.ts`: `export {};`
- `packages/foo/vitest.config.ts`: `include: ["src/**/*.{test,spec}.{ts,tsx}"], passWithNoTests: true`
- **vite preset:** also runs `pnpm add -D --filter=@<scope>/foo vite`.
- **react preset:** also runs `pnpm add --filter=… react react-dom` and `pnpm add -D --filter=… vite @vitejs/plugin-react @types/react @types/react-dom`.
- **Other presets:** it only prints "Run 'pnpm install'…".
- It never adds `exports`, `types`, a `build` script, a README, or tsconfig overrides.

### `.github/workflows/ci.yml` (verbatim, new in `d59e2aa`)
```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      # The pnpm version comes from "packageManager" in package.json
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      # The writing rules (ASD-STE100) of the README files and the doc comments
      - run: pnpm lint:ste
```

### Other root files
- **`.gitattributes`:** `* text=auto eol=lf` plus `binary` for `*.png *.jpg *.jpeg *.ico *.woff2 *.pdf`.
- **`.gitignore`** (113 lines; the parts that matter):
  - `.claude/`, `.mcp.json`, `_db/`
  - `/*.md` with `!/CLAUDE.md` and `!/README.md`, so any other Markdown file at the repo root is ignored
  - the ste-lint block:
    ```
    # Local ste-lint dictionaries. The ASD-STE100 dictionary is copyrighted: do not commit it.
    .ste/
    *.ste-dictionary.json
    ```
  - secrets patterns: `*.token`, `*sensitive*`, `.env*`, `*.pem`, `*.key`, `secrets.*`, `credentials.*`
  - `.vscode/` and `.idea/`
  - a Python block that ignores **any directory named** `build/`, `dist/`, `lib/`, `lib64/`, `env/`, `ENV/`, `var/`, `parts/`, `downloads/`, `eggs/`, `wheels/` or `sdist/`
  - `node_modules/`, `*.db`, `*.sqlite`, `*.duckdb`, `tmp/`, `temp/`, `*.bak`
- **`CLAUDE.md`:** "Write all prose of this repository in the style of ASD-STE100 Simplified Technical English (STE)…". Its bullets:
  - Run `pnpm lint:ste` after a prose change, and fix each finding. CI fails on errors.
  - At most 20 words per instruction and 25 per description.
  - No `should`, `may`, `might` or `would`, no semicolons, no `e.g.`, `i.e.` or `etc.`.
  - Use the active voice, and start each doc comment with its subject ("This function returns…").
  - Put code in code font.
  - Add a word to the glossary only if it is a real technical term.
- **`ste.config.json`:**
  ```json
  {
    "$schema": "./node_modules/@mark1russell7/ste-lint/ste.config.schema.json",
    "include": ["README.md","CLAUDE.md","packages/*/README.md","packages/*/src/**/*.{ts,tsx}","packages/*/*.config.{ts,mts}"],
    "ignore": ["**/node_modules/**","**/dist/**","**/*.d.ts","**/*.test.ts","**/*.test.tsx","**/*.spec.ts","**/*.spec.tsx"],
    "technicalNouns": [], "technicalVerbs": [],
    "properNouns": ["ASD","ASD-STE100","Claude","GitHub","pnpm","Simplified Technical English","TSDoc","TypeScript"]
  }
  ```

### What `new-repo.ps1` does
1. Checks that the name matches `^[a-z0-9][a-z0-9-]*$`.
2. Runs `robocopy /E`, skipping the directories `.git`, `node_modules`, `_db` and `.claude`, and the file `pnpm-lock.yaml`. `.mcp.json` is therefore copied, but git ignores it.
3. Replaces the name with a regex: `"template-monorepo"` becomes `"<name>-monorepo"`. In `packages/cli/package.json`, `"@template/cli"` becomes `"@<name>/cli"` and the bin `"template": "./src/index.ts"` becomes `"<name>": "./src/index.ts"`. Files are written as UTF-8 without BOM.
4. Runs `git init -q`. It does not install, commit or add a remote.
5. Prints `cd …`, `pnpm install`, and `pnpm package add <pkg-name>`.

Because the lockfile is not copied, the first install takes the newest caret versions and the current HEADs of cue and ste-lint.

## (b) Rules for a package in the template monorepo
1. It lives at `packages/<name>/`, and the folder name is the unscoped package name.
2. The package name is `@<scope>/<name>`, where the scope is the root name without `-monorepo`.
3. Create it with `pnpm package add`. Don't hand-write `package.json`; lag's README says the same about its own generator.
4. `package.json` must have:
   - `"version": "0.1.0"`, `"private": true`, `"type": "module"`
   - **`"main": "./src/index.ts"`**. Packages are used as TypeScript source with no build step, no `dist`, no `exports` and no `types` field.
   - the scripts `test` (`vitest run`), `test:watch` (`vitest`) and `typecheck` (`tsc --noEmit`)
   - The root runs `pnpm -r run test` and `pnpm -r run typecheck`. github.io also adds a root `build` (`pnpm -r run build`) and `dev`.
5. The tsconfig extends `@mark1russell7/cue/ts/config/<node|node-cjs|ts|vite|react>.json`. In practice packages add these overrides:
   - `"types": ["node"]` (packages/cli and ste-lint)
   - `"noEmit": true, "allowImportingTsExtensions": true` so relative imports can end in `.ts` (packages/cli and the github.io site)
   - `"composite": false, "incremental": false` (the github.io site)
6. Code must pass the strict cue flags listed above.
   - Under `nodenext`, relative imports need an extension (`.js`, or `.ts` with `allowImportingTsExtensions`).
   - Type-only imports need `import type`.
   - Exported functions need explicit return types (`isolatedDeclarations`).
7. Tests live next to the code as `src/**/*.{test,spec}.{ts,tsx}`. Each package has its own `vitest.config.ts` with `passWithNoTests: true`. There is no root vitest workspace and no coverage setup.
8. Test files are **not typechecked**: cue's `lib.json` excludes `*.test.ts` and `*.spec.ts`, and the template has no `tsconfig.test.json`.
9. Prose follows STE: the TSDoc in `packages/*/src/**`, `packages/*/README.md`, `packages/*/*.config.{ts,mts}`, and the root README and CLAUDE.md. CI runs `pnpm lint:ste` and fails on any error.

## (c) lag (`lag`): not built from the template
lag started on 2026-02-22 and has 92 commits on main, so it is older than the template (2026-05-25). It follows a different architecture. The repo that really comes from the template is github.io: its `packages/cli` differs from the template's only in name and bin.

### Branch state
- `main` is at `d8baf4b` (11:23).
- The main working copy is on `experiment/e6-worker-output` (`e1df932`, with uncommitted experiment files).
- `chore/shared-ste-lint` is checked out as a worktree at `.claude/worktrees/shared-ste-lint`. It is 2 commits ahead of main (`751a9c1`, `3b5dc54`), pushed, and **not merged**.

### Differences from the template
- **Root `package.json`:**
  - `"name": "lag"`, with no `packageManager` and no `engines`
  - devDependencies: `tsx ^4.21.0`, `typescript ^5.9.3`
  - scripts:
    - `new` = `tsx packages/scripts/src/new-package.ts`
    - `build` = `tsc -b`
    - `typecheck` = `tsc -b && pnpm -r --if-present typecheck`
    - `test` = `pnpm --filter @lag/core --filter @lag/load --filter @lag/report --filter @lag/scripts test`
    - `test:browser`, `test:chromium`, `test:integration`, `test:overhead`, `test:soak`, `test:e2e`, `coverage`, `mutation`, `results`, `readme:metrics(:check)`
    - `"lint:ste": "tsx packages/ste-lint/src/cli.ts"`
- **`pnpm-workspace.yaml`:** only `packages: ["packages/*"]`.
- **Root `tsconfig.json`:** `"files": []` plus references to `packages/{lag, lag-integration-tests, lag-worker, load, report, scripts, site, ste-lint}`.
- **No cue dependency.** It has its own copy of the presets in `ts/config/*.json`, identical to cue except that `base.json` has no `"diagnostics": true` and `node.json` adds `"compilerOptions": { "types": ["node"] }`. Packages extend `../../ts/config/<preset>.json`.
- **Package pattern:**
  - `version 0.0.0`, built to `dist` by `tsc -b`
  - `main`/`types` point at `dist`, with an `exports` map (`types` + `import`)
  - each package has a `tsconfig.test.json` (`noEmit`, `composite false`, `incremental false`, `declaration(Map) false`, `isolatedDeclarations false`, `include src/**/*`, `exclude []`), so tests **are** typechecked
  - Vite-based consumers point `@lag/*` at `../<dir>/src` through `resolve.alias`
- **Package generator `pnpm new --name <n> --config <ts|node|node-cjs|vite|react>`:**
  - writes a `package.json` with `@lag/<n>`, `0.0.0`, `private`, `type: module` (except for `node-cjs`), `main: dist/index.js`, `types: dist/index.d.ts`, `exports`, and a `build` script of `tsc -b`
  - writes a tsconfig that extends the local preset, and an empty `src/index.ts`
  - adds a sorted reference to the root tsconfig
  - adds no vitest config, no test script and no devDependencies
- **Packages:**

  | Folder | Package | Purpose | Preset |
  |---|---|---|---|
  | `packages/lag` | `@lag/core` | Monitors and metric catalog | ts |
  | `packages/lag-worker` | `@lag/worker` | The Web Worker | vite |
  | `packages/load` | `@lag/load` | Synthetic main-thread load | vite |
  | `packages/report` | `@lag/report` | Test-report format and converters | ts |
  | `packages/scripts` | `@lag/scripts` | `pnpm new`, `results`, `readme-metrics` | node |
  | `packages/site` | `@lag/site` | Vite + React + MDX docs site, deployed to GitHub Pages | react, with overrides |
  | `packages/lag-integration-tests` | `@lag/integration-tests` | Browser tests | vite |
  | `packages/ste-lint` | `@lag/ste-lint` | The linter (main only) | node |

  - `@lag/core` exports 7 subpaths.
  - `@lag/integration-tests` depends on `github:mark1russell7/otel-ts` and `github:mark1russell7/grafana-infra`.
- **Tests:**
  - Unit tests: vitest in Node with fake timers.
  - `@lag/core` coverage (v8) has thresholds of statements 98, branches 96, functions 98 and lines 98.
  - Stryker mutation testing has `break: 95`.
  - Integration tests run in Vitest browser mode, with projects browser, cdp, coi, overhead, soak, e2e and safari. Playwright drives Chromium, Firefox, WebKit and Chrome; webdriverio drives Safari.
  - The site has a node project and a browser project (Chromium).
- **CI:** all jobs use `pnpm/action-setup@v4` with `version: 10`, `setup-node@v4` with `node-version: 24`, and `checkout@v4`.
  - `ci.yml`, job `build`: install, build, typecheck, test, coverage, upload coverage, **STE lint**, README metric check. Other jobs: a browser matrix (chromium, firefox, webkit); a `safari` job on macOS with `continue-on-error`; and `site` (typecheck, test, build).
  - `e2e.yml`: weekly plus manual dispatch, with docker compose of grafana-infra.
  - `mutation.yml`: weekly Stryker run.
  - `pages.yml`: on push to main, a safari job, then build (pnpm results, `SITE_BASE`), then deploy.
- **Tooling versions:** TypeScript 5.9, vitest 4.1, vite 7.3, @types/node 25, @clack/prompts 0.9. The lockfile comes from pnpm 10, and pnpm 10.26 runs locally.
- **Other files:**
  - `lag.code-workspace` (sets `typescript.tsdk`)
  - `.claude/settings.local.json` is **tracked**, while the template ignores `.claude/`
  - a short `.gitignore` (`**/node_modules/`, `**/dist/`, `**/*.tsbuildinfo`, `.claude/worktrees/`, the ste dictionary block, coverage, Stryker files)
  - `.gitattributes` without `jpeg` or `pdf`
  - no CLAUDE.md

### Every ste-lint touchpoint on lag `main`
- `package.json:19`: `"lint:ste": "tsx packages/ste-lint/src/cli.ts",`. It runs from source with tsx; there is no dependency entry, no submodule, no ESLint and no hooks.
- `tsconfig.json`: the reference `{ "path": "packages/ste-lint" }`.
- `ste.config.json:2`: `"$schema": "./packages/ste-lint/ste.config.schema.json",`.
  - `include`: `README.md`, `docs/**/*.{md,mdx}`, `packages/*/README.md`, `packages/site/**/*.{md,mdx}`, `packages/*/src/**/*.{ts,tsx}`, `packages/*/build/**/*.{ts,tsx}`, `packages/*/commands/**/*.{ts,tsx}`, `packages/*/*.config.{ts,mts}`, `packages/site/content/**/*.{ts,tsx}`.
  - It uses the same 7 `ignore` patterns as the template.
  - The glossary has 66 `technicalNouns`, 29 `technicalVerbs` and 45 `properNouns`.
  - It ends with `"allowedWords": [], "rules": {}, "wordList": [], "dictionaryPath": null`.
- `.gitignore`: the same three dictionary lines.
- `.github/workflows/ci.yml`, inside the `build` job after the coverage upload:
  ```yaml
      # The writing rules (ASD-STE100) of the README, the site and the comments
      - name: STE lint
        run: pnpm lint:ste
  ```
- `packages/ste-lint/` (`@lag/ste-lint`, private, bin `ste-lint` at `./dist/cli.js`, runtime dependency `typescript ^5.9.3`). Its tests are not part of root `pnpm test`; they run through `pnpm --filter @lag/ste-lint test`.
- Docs that mention it: README lines 17 and 121; site pages `docs/contributing/{development,writing-style}.mdx`, `docs/index.mdx`, `docs/testing/strategy.mdx`, `research/{index,sources,writing-standard}.mdx`; and the `ste-lint` node in `packages/site/src/architecture/graph.ts`.

### Changes on branch `chore/shared-ste-lint` (`3b5dc54`)
- Root script `"lint:ste": "ste-lint"` and devDependency `"@mark1russell7/ste-lint": "github:mark1russell7/ste-lint"`.
- `packages/ste-lint` and its tsconfig reference are deleted.
- `"$schema": "./node_modules/@mark1russell7/ste-lint/ste.config.schema.json"`.
- `pnpm-workspace.yaml` ends up **the same as main**. `751a9c1` had added `onlyBuiltDependencies: ["@mark1russell7/ste-lint"]`, and `3b5dc54` removed it.
- The lockfile pins `f597d6c`.
- The README and site pages link to the new repo.
- CI does not change.

## (d) How to add ste-lint to a repo, as lag and github.io do
**If you create the new repo from the template at `d59e2aa` or later, steps 1–4 and 6 are already done.**

1. Add the root devDependency `"@mark1russell7/ste-lint": "github:mark1russell7/ste-lint"`. The command is `pnpm add -D -w github:mark1russell7/ste-lint`. ste-lint's README leaves out `-w`, but pnpm refuses to add a dependency to a workspace root without it. The lockfile pins `https://codeload.github.com/mark1russell7/ste-lint/tar.gz/<sha>`; run `pnpm update @mark1russell7/ste-lint` to take newer commits.
2. Add the root script `"lint:ste": "ste-lint"`.
3. **Change nothing in `pnpm-workspace.yaml`.** Since `f597d6c` the install builds nothing. The `allowBuilds` entry (pnpm 11 and later) and `onlyBuiltDependencies` (pnpm 10) that were needed for `35b6159` are now removed from all three consumers.
4. Add a root `ste.config.json` with `"$schema": "./node_modules/@mark1russell7/ste-lint/ste.config.schema.json"`. Copy the template's version from (a) and add the project glossary. **Add `"docs/**/*.{md,mdx}"` if root `docs/` should be checked; the template and github.io don't check it.**
5. Add the `.gitignore` block `.ste/` and `*.ste-dictionary.json` with its comment.
6. Add a CI step, `- run: pnpm lint:ste`, with a comment line.
7. Add CLAUDE.md with the writing-style section (template and github.io have it; lag does not).
8. In the README (the github.io pattern):
   - add `pnpm lint:ste    # the writing rules` to the command list
   - add a `## Writing style` section: STE is a style target; ASD does not certify the repo; the glossary is in `ste.config.json`; keep the dictionary in `.ste/` and don't commit it
   - add a `## Disclosure` section: "An AI model (Claude, from Anthropic) wrote most of the text and the code of this repository, under the direction of the author. … The STEMG of ASD-STE100 asks for this disclosure in its white paper on STE and artificial intelligence (June 2026)."
9. Rewrite the prose until there are 0 errors. Warnings fail only with `--max-warnings`.
10. Optional extras:
    - suppression comments: `<!-- ste-disable-next <rule> -- reason -->`, `<!-- ste-disable -->`/`<!-- ste-enable -->`, `{/* ste-disable */}` in MDX, and `// ste-disable-next` before a doc comment
    - a dictionary through the `STE_DICTIONARY` environment variable or `dictionaryPath`

### lag compared with github.io
| | lag (branch) | github.io |
|---|---|---|
| CI step | Named `STE lint`, in the `build` job, after `pnpm build` and the coverage step; pnpm 10, Node 24 | Unnamed `- run: pnpm lint:ste` at the end of the `ci` job; pnpm from `packageManager` (12.10.1), Node 26 |
| `ste.config.json` | Broad includes (docs, site content, build, commands) and a big glossary | Includes `CLAUDE.md`, `packages/site/**/*.{md,mdx}` and 13 proper nouns |
| CLAUDE.md | None | Has one |
| How the process is documented | In site MDX pages | In the README |

## (e) ste-lint (`ste-lint`, `github.com/mark1russell7/ste-lint`)
- **Purpose:** checks English prose against the writing rules of ASD-STE100 (Issue 9). It is a heuristic approximation; it does not certify compliance.
- **What it reads:**
  - Markdown and MDX: paragraphs, list items, block quotes, headings and table cells. It skips code, front matter, JSX, imports/exports and link URLs.
  - TS and JS doc comments `/** */`, parsed with the TypeScript compiler API. It skips `@param` names and `@example`.
  - TSX and JSX text, plus the `title`, `aria-label` and `alt` attributes.
  - Each code span, URL or quoted text counts as one word.
- **Package:**
  - `@mark1russell7/ste-lint` 0.1.0, ESM, `engines.node >=22`, `packageManager pnpm@12.10.1`
  - `bin` `ste-lint` at `./dist/cli.js`
  - `exports`: `"."` (`types` + `import`, from `dist`) and `"./ste.config.schema.json"`
  - `files`: `dist`, `src`, `ste.config.schema.json`
  - runtime dependency `typescript ^6.0.3`. TS 7 has no JavaScript API, so it can't be used here.
  - devDependencies: cue, `@types/node ^26.6.4`, `tsx ^4.23.15`, `vitest ^5.0.3`
  - **Not on npm. No tags or releases.** You can only install it as `github:`.
  - `dist/` is committed (since `f597d6c`), and CI checks that it matches `src/`.
- **CLI:** `ste-lint [patterns...] [--format text|json] [--max-warnings n] [--config path] [-h]`. Exit code 0 is OK, 1 means errors or too many warnings, 2 means bad usage or config, or no files. It looks for `ste.config.json` in the current directory or a parent.
- **Defaults when there is no config:**
  - include: `README.md`, `docs/**/*.{md,mdx}`, `packages/*/README.md`, `packages/*/src/**/*.{ts,tsx}`, `packages/*/build/**/*.{ts,tsx}`, `packages/*/commands/**/*.{ts,tsx}`, `packages/*/*.config.{ts,mts}`
  - ignore: the 7 patterns above
- **Config keys:** `include`, `ignore`, `technicalNouns`, `technicalVerbs`, `properNouns`, `allowedWords`, `rules` (`error`/`warning`/`off`), `wordList` entries (`id`/`match`/`suggest`/`note`/`severity`/`verbOnly`), `limits` (`instructionWords` 20, `descriptionWords` 25, `paragraphSentences` 6, `nounClusterNouns` 3), `dictionaryPath`. The environment variable `STE_DICTIONARY` takes priority over `dictionaryPath`.
- **The 14 rules, with default severity:**
  - `sentence-length` (error)
  - `paragraph-length` (warning)
  - `modal-verb` (error)
  - `semicolon` (error)
  - `latin-abbreviation` (error)
  - `about-quantity` (error)
  - `word-list` (set per entry; plain-language replacements such as "use" for "utilize")
  - `gendered-pronoun` (error)
  - `first-person` (warning)
  - `passive-instruction` (warning)
  - `noun-cluster` (warning)
  - `missing-subject` (error; doc comments only)
  - `ing-verb` (warning)
  - `unknown-word` (warning; active only when there is a dictionary)
- **API:** `Linter`, `lintText`, `runCli`, `loadConfig`, `RULES`, `DEFAULT_WORD_LIST`, and others.
- **Source layout:** `src/{cli,run-cli,config,dictionary,files,format,lexicon,lint,types,units,word-list}.ts`, plus `rules/`, `source/` (markdown, blocks, inline, jsx, tsdoc, lines, suppressions) and `text/` (grammar, phrases, sentences, tokens, words). Tests sit next to the code.
- **The repo itself:** a single package, not a monorepo. Its tsconfig extends cue `node.json` with `types: ["node"]`, and it has a `tsconfig.test.json`. Its CI runs install, typecheck, test, build, the `dist/` check, and `lint:ste`.

## (f) Funk and concat-src
- **Not packages anywhere.** Neither has a `package.json`, either at the commits Vex pins or at the upstream HEAD.
- **Not consumed** by the template, lag, github.io or ste-lint.
- **No standalone clones** exist in the workspace folder. They appear only as submodule checkouts:
  - `Vex/external/Funk` at `69fa9c9`
  - `Vex/external/concat-src` at `4a6fecd`
  - `Jqy/external/concat-src`, which is registered but **not initialized** (empty folder)
- **Grep results:** in `*/package.json` and `*/packages/*/package.json` the only hit is Jqy's `"dump:src": "node scripts/concat-src.js"`. Jqy's `scripts/` folder doesn't exist, so that script is broken.
- **npm:** `@mark1russell7/funk`, `@mark1russell7/concat-src` and `@mark1russell7/cue` all return 404. `funk` belongs to an unrelated project (usermirror/funk). `concat-src` was unpublished in 2015.
- **Funk upstream:** HEAD is `9c4c93a` (2025-09-10), 4 commits ahead of Vex's pin. Those commits add a README and a nested submodule `external/concat-src` whose URL is `git@github.com-personal:…`, an SSH host alias that other machines and CI can't resolve. **`optional/optional.ts` (blob `72cc29b`) and `optional/either.ts` (blob `587286f`) are byte-identical at the pin and at HEAD.**
- **concat-src upstream:** HEAD is `04195f0` (2025-10-29), 1 commit ahead. `concat-src.js` grew from 3279 to 4936 bytes. It is a developer script that joins the `.ts`/`.tsx` files under the current directory into `src-catalog.md`. Vex never imports it, and Funk has its own copy.
- **What Vex uses:** 22 import statements in 15 files, all extensionless and all into `external/Funk/optional/optional` or `optional/either`. Only those two files are needed, and they don't depend on anything else: `optional.ts` imports `./either`, and `either.ts` imports nothing. Funk's own tsconfig is a stock `tsc --init` (es2016, commonjs).

## (g) Surprises and broken bits
1. **Typecheck breaks in packages from `pnpm package add`.** TS 7 defaults `types` to `[]`. The generated tsconfig doesn't set it, and neither does cue's `node.json`. I checked: with TS 7.0.2, `node:url` gives `TS2591` unless you pass `--types node`. So a generated node package fails `tsc --noEmit` as soon as it imports `node:*` or uses `process` or `console` (with `lib: ["esnext"]` only, `console` isn't defined either). packages/cli, ste-lint and lag's own copy of the presets work around this with `types: ["node"]`.
2. **Imports between workspace packages fail typecheck under the cue presets.** In a two-package test, package A imported B's `src/index.ts` and `tsc --noEmit` failed with **TS6059** (not under `rootDir`) and **TS6307** (not in the composite file list). It passed once I turned off `composite` and widened `rootDir`. The template's `main: ./src/index.ts` pattern has never been used for one package importing another; github.io's site doesn't import the cli. Splitting Vex into several packages (for example a separate funk package) needs either `composite: false` plus a `rootDir` override in each consuming package, or lag-style references with `dist`.
3. **Tests are never typechecked** in template packages (see rule 8 in section b). lag and ste-lint add `tsconfig.test.json` for this.
4. **Every tsc run prints statistics** (Files, Lines, Memory) because cue sets `diagnostics: true`. lag's copy removes it.
5. **The Python block in the `.gitignore`** silently ignores any directory named `lib/`, `build/`, `env/`, `var/` and so on. lag's `packages/site/build/` would be ignored under it. Vex has no paths like that; I checked.
6. **Very new tooling:** pnpm 12.10.1, TypeScript 7.0.2 (native compiler, no JS API), vitest 5, vite 8, @types/node 26, Node 26 in CI. cue declares `engines.node >=25` while the template says `>=22`.
7. **Submodules in CI:** `checkout@v7` doesn't fetch submodules unless you set `submodules:`. Vex's `.gitmodules` uses `git@github.com:` SSH URLs, which fail in Actions without a key. Funk's nested submodule uses the `github.com-personal` alias.
8. **Vex today:** npm with `package-lock.json`, `"test": "vitest"`, vitest ^3.2.4, @types/node ^24, no `"type": "module"`, tsconfig with `esnext` + `bundler`, and tests in `tests/` instead of `src/`.
9. **Vex measured against the cue node preset.** I passed the preset's flags on the tsc 7 command line with `--noEmit` (no tsconfig), over 47 non-test files. Result: 437 errors.
   - 259 of them are TS1295/TS1287, caused only by the missing `"type": "module"`.
   - The real gaps: 99 TS9013 and 15 other isolatedDeclarations errors (TS9016, 9011, 9039, 9012, 9007); 22 TS1484 (needs `import type`); 18 strictness errors (TS2345, 2532, 2322); 11 unused-code errors (TS6133, 6196); 6 TS4114 (needs `override`).
   - Once Vex is ESM, expect about 123 more TS2835 for extensionless relative imports in source, and 50 more in `tests/`.
   - By area (including the format errors): dsl 264, math 101, Funk 26, monads 22, optional.utils.ts 12, brand.ts 8, algebra 4.
10. **Vex's STE baseline** with default rules: 456 findings (358 errors, 98 warnings) in 20 of 51 files.

    | File or area | Findings |
    |---|---|
    | `docs/BUGS.md` | 119 |
    | `docs/ARCHITECTURE.md` | 117 |
    | `README.md` | 107 |
    | `docs/ROADMAP.md` | 89 |
    | dsl | 12 |
    | math | 8 |
    | monads | 3 |
    | algebra | 1 |

    By rule: semicolon 201, word-list 142, sentence-length 34, ing-verb 27, latin-abbreviation 23, modal-verb 20, passive-instruction 9. With the template's include patterns (no `docs/`), only about 130 of these would be checked.

## Versions and dates
- **Local tools:** Node v25.2.1 (nvm4w), npm 11.6.2, git 2.52.0.
- **pnpm:** the global install is 10.26.0. In template, github.io and ste-lint, `packageManager` switches it to 12.10.1 (cached in `%LOCALAPPDATA%\pnpm\.tools\pnpm\12.10.1`). lag and Vex run 10.26.0.
- **Template:** HEAD `d59e2aa`, 2026-10-08 13:06; dependencies updated the same day at 11:57.
- **lag:** main `d8baf4b` at 11:23 today. Branches: `experiment/e6-worker-output` at 11:59, `chore/shared-ste-lint` at 13:00.
- **ste-lint:** `f597d6c` at 12:43.
- **github.io:** `c618739` at 13:03.
- **cue:** `fb96d13`, 2026-02-18.

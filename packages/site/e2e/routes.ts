/** The routes of the built site. The checks of the site read them from `dist`, so each new page joins the checks. */
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");

/** This function gives the route of each page in `dist`, for example `learn/tour/`. */
export function routes(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === "_astro" || e.name === "pagefind" ? [] : routes(join(dir, e.name));
    if (e.name !== "index.html") return [];
    const rel = relative(DIST, dir).split(sep).join("/");
    return [rel === "" ? "" : `${rel}/`];
  });
}

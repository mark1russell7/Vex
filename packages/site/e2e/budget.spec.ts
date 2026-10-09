/**
 * The size budget. The check loads each page of the built site and adds the gzip size of each response. A page stays
 * at 256 kB or less, and its script stays at 160 kB or less. The heaviest page was 205 kB when the budget started.
 */
import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { routes } from "./routes.ts";

const PAGE_BUDGET = 256 * 1024;
const SCRIPT_BUDGET = 160 * 1024;

for (const route of routes()) {
  test(`the page /${route} stays in the size budget`, async ({ page }) => {
    const sizes: Promise<{ readonly type: string; readonly gz: number }>[] = [];
    page.on("response", (r) => {
      sizes.push(
        r.body().then(
          (b) => ({ type: r.request().resourceType(), gz: gzipSync(b).length }),
          () => ({ type: "none", gz: 0 }),
        ),
      );
    });
    await page.goto(`./${route}`);
    await page.waitForLoadState("networkidle");
    const all = await Promise.all(sizes);
    const total = all.reduce((s, x) => s + x.gz, 0);
    const script = all.filter((x) => x.type === "script").reduce((s, x) => s + x.gz, 0);
    expect(total, `the page in bytes`).toBeLessThanOrEqual(PAGE_BUDGET);
    expect(script, `the script in bytes`).toBeLessThanOrEqual(SCRIPT_BUDGET);
  });
}

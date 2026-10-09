/**
 * The accessibility check. axe-core examines each page of the built site with the rules of WCAG 2.1 AA, in the light
 * theme and in the dark theme. The list of pages comes from `dist`, so each new page joins the check.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { routes } from "./routes.ts";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const route of routes()) {
      test(`the page /${route} has no WCAG 2.1 AA violation`, async ({ page }) => {
        await page.goto(`./${route}`);
        await page.waitForLoadState("networkidle");
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const found = result.violations.map((v) => `${v.impact ?? ""} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
        expect(found).toEqual([]);
      });
    }
  });
}

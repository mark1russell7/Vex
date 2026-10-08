import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const dist = fileURLToPath(new URL("../dist", import.meta.url));

/** This function gives each route of the build: each folder with an index.html. */
function routes(dir: string = dist): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name.startsWith("_") || name === "pagefind") continue;
      out.push(...routes(p));
    } else if (name === "index.html") {
      out.push(relative(dist, dir).replaceAll("\\", "/"));
    }
  }
  return out;
}

/** This function scrolls a widget into view and waits until its island has hydrated. */
async function hydrated(region: ReturnType<Page["getByRole"]>): Promise<void> {
  await region.scrollIntoViewIfNeeded();
  // Astro removes the attribute "ssr" from an island when the island hydrates.
  await expect(region.locator("xpath=ancestor::astro-island[1]")).not.toHaveAttribute("ssr", /.*/);
}

/** This function collects the console errors and the page errors of a page. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page: ${e.message}`));
  return problems;
}

for (const route of routes()) {
  test(`the page /${route} renders without errors`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(route === "" ? "./" : `./${route}/`);
    await expect(page.locator("h1").first()).toBeVisible();
    // Wait for the islands to start.
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });
}

test("the stepper on the home page evaluates the overlap program", async ({ page }) => {
  await page.goto("./");
  const stepper = page.getByRole("region", { name: "Does the box overlap another box?" });
  await hydrated(stepper);
  await expect(stepper.getByText("Result at A:")).toBeVisible();
  await expect(stepper.locator(".vx-chip[data-state='ok']").first()).toHaveText("true");
  await stepper.getByRole("button", { name: "C", exact: true }).click();
  await expect(stepper.getByText("Result at C:")).toBeVisible();
});

test("the Lab shows the result at each origin and builds a chain from chips", async ({ page }) => {
  await page.goto("./lab/");
  const lab = page.getByRole("region", { name: "The Lab" });
  await hydrated(lab);
  await expect(lab.getByRole("table", { name: "The result at each origin" })).toBeVisible();
  await lab.getByRole("button", { name: "Clear" }).click();
  await lab.getByRole("button", { name: 'from("size")' }).click();
  await expect(lab.locator("pre.vx-code")).toContainText('root.from("size")');
});

test("the Game of Life computes a generation with the Vex rule", async ({ page }) => {
  await page.goto("./gallery/life/");
  const life = page.getByRole("region", { name: "The Game of Life with a Vex rule" });
  await hydrated(life);
  await expect(life.getByText("generation 0")).toBeVisible();
  await life.getByRole("button", { name: "One generation" }).click();
  await expect(life.getByText("generation 1")).toBeVisible();
});

test("the living spec shows a chip for each requirement", async ({ page }) => {
  await page.goto("./spec/");
  await expect(page.locator('[id="req-EVAL.TOTAL"]')).toBeVisible();
  expect(await page.locator(".vx-chip[id^='req-']").count()).toBeGreaterThan(50);
});

test("the cycle lab marks each cell on a cycle", async ({ page }) => {
  await page.goto("./learn/sheets/");
  const lab = page.getByRole("region", { name: "The cycle lab" });
  await hydrated(lab);
  await expect(lab.getByTestId("cell-a")).toHaveText("#CYCLE!");
  await expect(lab.getByTestId("cell-b")).toHaveText("#CYCLE!");
  await expect(lab.getByTestId("cell-c")).toHaveText("3");
  // Without the read from b to a, the cycle is gone: a = 1 + b = 3, and c = 3 + a = 6.
  await lab.getByRole("checkbox", { name: "b reads a" }).uncheck();
  await expect(lab.getByTestId("cell-a")).toHaveText("3");
  await expect(lab.getByTestId("cell-c")).toHaveText("6");
  // A read of itself is a cycle, also with ifError.
  await lab.getByRole("checkbox", { name: "c reads c" }).check();
  await expect(lab.getByTestId("cell-c")).toHaveText("#CYCLE!");
});

test("the grid pilot gives the rectangles of the reference", async ({ page }) => {
  await page.goto("./gallery/grid/");
  const pilot = page.getByRole("region", { name: "The grid pilot" });
  await hydrated(pilot);
  await expect(pilot.getByTestId("grid-agrees")).toHaveText("equal to the reference");
  await pilot.getByRole("slider", { name: "columns" }).fill("3");
  await pilot.getByRole("button", { name: "New sizes" }).click();
  await expect(pilot.getByTestId("grid-agrees")).toHaveText("equal to the reference");
  await expect(pilot.locator("svg rect[rx]")).toHaveCount(7);
});

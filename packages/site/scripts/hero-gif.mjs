// This script records the live hero of the home page and writes docs/assets/hero-light.gif and hero-dark.gif, the
// pictures at the top of the README. It needs ffmpeg on the path and the preview server of the built site:
//   pnpm build && pnpm exec astro preview --port 4330 --host 127.0.0.1
//   node scripts/hero-gif.mjs
// The script controls the clock of the page. It advances the clock by one frame, and then it takes a screenshot.
// Thus each frame is sharp, and the motion does not depend on the speed of the computer.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.VEX_SITE ?? "http://127.0.0.1:4330/vex/";
const outDir = fileURLToPath(new URL("../../../docs/assets/", import.meta.url));
const FPS = 15;
const FRAMES = 105;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const scheme of ["light", "dark"]) {
  const frames = mkdtempSync(join(tmpdir(), "vex-hero-"));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: scheme, deviceScaleFactor: 2 });
  await page.clock.install();
  await page.goto(url);
  // Astro removes the attribute "ssr" from an island when the island hydrates.
  await page.locator("astro-island:has(.vx-hero-live):not([ssr])").waitFor();
  const hero = page.locator(".vx-hero-live");
  const box = await hero.locator("svg").boundingBox();
  if (box === null) throw new Error("the hero has no picture");
  // Remove the shadow of the figure, so the frame has clean edges.
  await hero.evaluate((el) => (el.style.boxShadow = "none"));
  for (let i = 0; i < FRAMES; i++) {
    // The pointer selects box E for a part of the clip, so the clip also shows the list of the program at one box.
    if (i === 35) {
      const label = await hero.locator("svg text").filter({ hasText: /^E$/ }).boundingBox();
      if (label === null) throw new Error("the hero has no box E");
      await page.mouse.move(label.x + label.width + 8, label.y + label.height + 8);
    }
    if (i === 85) await page.mouse.move(box.x - 40, box.y - 40);
    await page.clock.runFor(1000 / FPS);
    await hero.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.png`), animations: "allow" });
  }
  await page.close();
  const out = join(outDir, `hero-${scheme}.gif`);
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-framerate", String(FPS), "-i", join(frames, "f%04d.png"),
    "-vf", "scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
    "-loop", "0", out,
  ]);
  rmSync(frames, { recursive: true, force: true });
  console.info(`wrote ${out}`);
}
await browser.close();

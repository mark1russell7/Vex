// This script copies the sources and the tests of @mark1russell7/vex, @mark1russell7/vex-domains and @mark1russell7/vex-testkit to work/. Stryker reads only the
// files under its working folder, and its Vitest runner loads the Vitest of that folder (4.1, not 5).
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
rmSync(`${here}work`, { recursive: true, force: true });
for (const p of ["core", "domains", "testkit"]) {
  cpSync(`${here}../../packages/${p}/src`, `${here}work/${p}`, { recursive: true });
}

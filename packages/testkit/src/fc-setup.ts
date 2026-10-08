/**
 * The global fast-check settings of the test runs. The variable `FC_SEED` sets the seed, so a failure in CI can
 * run again with the same values. The variable `FC_NUM_RUNS` sets the number of runs (the nightly run uses
 * 10000). Without `FC_SEED`, each run gets a new seed, and the setup prints it.
 */
import * as fc from "fast-check";

const seed = Number(process.env["FC_SEED"] ?? Math.floor(Math.random() * 2 ** 31));
const numRuns = Number(process.env["FC_NUM_RUNS"] ?? 200);
fc.configureGlobal({ seed, numRuns });
console.info(`fast-check seed ${seed}, ${numRuns} runs (set FC_SEED to repeat)`);

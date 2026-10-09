# Vex

Vex is a TypeScript library for typed spreadsheet formulas over domain objects.

A Vex program runs at one position in a collection of records. It reads fields relative to that position, combines them with domain operations, and gives a total result. A failure does not throw. It gives an error value that tells you what went wrong. Axes lift one program to all positions, or to relations between positions.

```ts doctest
import { space, vex } from "@mark1russell7/vex";
import { Vec2Domain } from "@mark1russell7/vex-domains";

const separated = vex(Vec2Domain)
  .over(space.record({ A, B }))
  .from("position")._.add("size")
  .other()._.subtract("position")
  ._.anyNonPositive();

separated.at("A"); // : Optional<boolean>
separated.at("A"); // => { tag: "some", value: false }
separated.explain("A"); // a trace of each step
```

## Status

Vex 1.0 is in development. The specification is in [`spec/README.md`](./spec/README.md), and the plan is in [`docs/REVIEW.md`](./docs/REVIEW.md). The code before the rebuild is in the git history (package `@vex/legacy`, removed after the parity tests passed).

| Package | Contents |
|---|---|
| [`@mark1russell7/vex`](./packages/core) | The kernel: spaces, addresses, the expression IR, domains, the interpreter, traces |
| [`@mark1russell7/vex-domains`](./packages/domains) | Domains for 2D vectors, named-component vectors, colors and angles |
| [`@mark1russell7/vex-testkit`](./packages/testkit) | Arbitraries, law checks and the reference interpreter for property tests |
| [`@vex/pilots`](./packages/pilots) | Programs of other projects in Vex: the grid layout of Graph |
| [`@vex/cli`](./packages/cli) | The workspace commands of the template |

## Commands

```sh
pnpm install
pnpm typecheck       # the source and the tests of each package
pnpm test            # the tests of each package
pnpm test:coverage   # the coverage of @mark1russell7/vex, with thresholds
pnpm test:docs       # the code blocks of the docs with the meta word "doctest"
pnpm lint            # Oxlint with type-aware rules
pnpm lint:ste        # the writing rules
pnpm check           # each of the commands above
pnpm --filter @mark1russell7/vex run bench          # the speed lane (report only)
pnpm --filter @vex/mutation run mutation   # the mutation lane (Stryker)
pnpm package add <name> --preset=ts        # make a new package
```

## Documents

- [`docs/REVIEW.md`](./docs/REVIEW.md): the review, the target architecture and the plan
- `docs/research/`: the research reports of the review. They contain local paths, so they stay out of the repository.
- [`docs/archive/`](./docs/archive): the July 2026 audit and the old v0.9 spec

## Writing style

The prose of this repository follows ASD-STE100 Simplified Technical English (STE). STE is a style target. ASD does not certify this repository. The project glossary is in `ste.config.json`. Keep a local copy of the STE dictionary in `.ste/`, and do not commit it.

## Disclosure

An AI model (Claude, from Anthropic) wrote most of the text and the code of this repository, under the direction of the author. The STEMG of ASD-STE100 asks for this disclosure in its white paper on STE and artificial intelligence (June 2026).

## License

MIT. Refer to [`LICENSE`](./LICENSE).

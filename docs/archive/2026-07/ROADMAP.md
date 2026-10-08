# Vex — Roadmap

> **Superseded (2026-10-08).** The plan in [REVIEW.md](../../REVIEW.md) §11 replaces this roadmap. It keeps the July phases as background only.

*Derived from the 2026-07-11 audit. IDs (V-xxx) reference [BUGS.md](./BUGS.md); background in [ARCHITECTURE.md](./ARCHITECTURE.md).*

## Guiding diagnosis

Vex's core ideas are sound (Optional-first totality, replayable IR, thin adapters, locals+optics). What undermines it today is a compounding pair: **the type system checks nothing** (V-012) **and the runtime never tells you what went wrong** (silent `none`s, and worse, silent *wrong values* — V-002/004/005/007). Fixing correctness before ergonomics, and killing global mutable state before adding features, is the whole strategy below.

A second theme: **decide what the product is.** The README specifies a proxy-driven chain DSL (`._`, `peers`, `fork`); the implementation's actual strength (and all its test coverage) is the *named-locals + optics* system the spec never mentions. Phase 3 forces that reconciliation; it's cheaper to update the spec than to build the unbuilt half, and both are legitimate — but pick deliberately.

Effort key: **S** ≤ ½ day · **M** 1–3 days · **L** ≈ 1 week+.

---

## Phase 0 — Hygiene (one sitting, do immediately)

Goal: a repo a stranger (or CI) can clone, typecheck, and test.

| # | Item | Fixes | Effort |
|---|---|---|---|
| 0.1 | Commit the pending `.gitmodules` URL fix | V-035 | S |
| 0.2 | `package.json`: `"test": "vitest run"`, add `"test:watch"`, `"typecheck": "tsc --noEmit"`; add `typescript` to devDependencies | V-030, V-031 | S |
| 0.3 | tsconfig: `exclude: ["dist", "node_modules"]` | V-033 | S |
| 0.4 | Delete stale artifacts: `out.txt`, `test.out.txt`, `dsl/Vex.code-workspace`; move `commands ie. update-submodules.txt` content into `docs/DEV.md`; extend `.gitignore` (`dist/`, `*.tsbuildinfo`) | V-034 | S |
| 0.5 | GitHub Actions: `npm ci && npm run typecheck && npm test` on push/PR | V-036 | S |
| 0.6 | Add ESLint (typescript-eslint, `no-unsafe-*` family will light up the `any` surface) + Prettier — warn-only at first | V-036 | M |

**Acceptance:** fresh clone → `npm ci && npm run typecheck && npm test` green in CI.

---

## Phase 1 — Correctness (fix confirmed bugs without redesign; ~1 week)

Goal: no silent wrong values; total surfaces actually total. Each fix lands with a regression test asserting the *spec* behavior (the audit's 12 verification tests, inverted, are the starting suite).

| # | Item | Fixes | Effort |
|---|---|---|---|
| 1.1 | Validate `ConstD` in `evalArg` via `adapter.isInstance` (else `none`) | V-007 | S |
| 1.2 | Failure-aware focus: `setFocusByKey/ByIndex/ToOther` return `boolean`; evaluator poisons to `none` on `false`. Covers unknown keys, out-of-range indices, `other()` with ≠2 keys, matrix garbage keys | V-004, V-005, V-019 | M |
| 1.3 | `methodOf` helper: op must be an **own** function on the domain's prototype chain (excluding `Object.prototype`) or an own instance field; use in all adapters | V-008 | S |
| 1.4 | Totality: try/catch in traversal `invoke` + all reducer projections (`map/sum/min/max/fold/any/all/none`); route `reduceBy` through `adapter.getMethod` + lift metadata | V-009 | M |
| 1.5 | Strict-mode unification: single `fail()` path, "first none is final" (no `Select` resurrection); document the per-step behavior table in the README | V-013, V-015 | M |
| 1.6 | `createDSL` → construct via the `withLocal` factories (or delete it) | V-014 | S |
| 1.7 | Guard or delete `MultiChain.build` select-lookup crash | V-011 | S |
| 1.8 | Freeze chains on first build/traverse (throw on post-build pushes) as interim mutability guard | V-010 | S |
| 1.9 | Remove `fromScalar` from plain `NDVectorAdapter` (unliftable by design; `add(5)` ⇒ `none`) | V-002 (partial) | S |
| 1.10 | Fix `Color.add` commutativity (annotation or symmetric alpha); document NDVector non-finite policy; replace `Vector.divide` 0-masking with real division or `divideSafe` | V-016, V-017, V-018 | S–M |
| 1.11 | Normalize `undefined` method results: `some(undefined)` ⇒ `none` (use Funk `nullable`) | V-022 | S |
| 1.12 | `applyUsing`: distinguish explicit `[]` order from unknown params; unknown params + no explicit order ⇒ `none` (not a zero-arg call) | V-023 | S |

**Acceptance:** all Phase-1 regression tests green; the audit repros now return `none` (or typed errors) instead of wrong values; suite still green.

---

## Phase 2 — Architecture (the structural fixes; 2–4 weeks)

Goal: remove the five structural flaws (ARCHITECTURE §5). Order matters: 2.1 unblocks 2.4; 2.2 unblocks Phase 3's `peers()`.

### 2.1 Adapter-owned op registry (kills global metadata) — **L** · fixes V-002, V-003, V-024, V-008 (properly)

```ts
interface OpDescriptor<D> {
  fn?: (self: D, ...args: any[]) => any;      // optional explicit impl (else prototype lookup by name)
  params?: ParamSpec[];
  returns?: ValueKind;
  meta?: OpMeta;                               // liftScalar / commutative / associative / pure
}
interface DomainAdapter<D> {
  name: string;
  isInstance(v: unknown): v is D;
  fromScalar?(n: number): D;
  ops: Record<string, OpDescriptor<D>>;        // single source of truth, owned per-adapter
  dynamicOps?: boolean;                        // opt-in: allow un-declared prototype methods (guarded by methodOf)
}
```

- Delete `annotateOp`, `DSL_OP_META`, `DSL_OP_META_TABLE`, and every module-level IIFE; adapters become inert data (no import side effects → V-003 gone by construction).
- Two adapters over one class (plain vs lifted NDVector) become trivially independent.
- Migration: mechanical — each `annotateOp(P, "add", meta)` + `methodParams` branch collapses into one `ops.add` entry.

### 2.2 Focus as value (kills shared mutable focus) — **L** · fixes V-004/V-005 at the root; unblocks `peers()`, concurrency

- `Scope<D>` becomes immutable data: `resolve(key) → Optional<FocusedScope<D>>`; evaluator threads `Optional<FocusedScope>` through steps (Switch = `chainOpt` over resolution).
- `evalProgram(adapter, steps, initial, scope, start)` — start is an argument, not pre-mutated state; `traverse`/`peers` become pure maps over `scope.keys()`.
- Interim (already done in 1.2 via booleans) is fine; this is the durable form.

### 2.3 One locals model (kills the disconnect) — **M** · fixes V-006

- Locals exist **only** as evaluation state written by steps. Delete `_local`, `getLocal`, `adoptLocal`, `localFor`; reimplement `localRename/Remove/Project/Clear/Merge` **as steps** (they're useful mid-program); `localRequire(shape)` becomes a step too (a runtime assertion point).
- If build-time seeding is genuinely wanted, make it explicit: `evalProgram(..., { seedLocals })` fed from `build({ locals })` — one documented pathway, not two silent ones.

### 2.4 Honest IR + step-handler registry (kills the `as any[]` monolith) — **L** · fixes V-020, V-021

- Extend `Step<D>` to the full 13-kind union; make `evalProgram` an exhaustive `switch` (compile-time `never` check).
- Dispatch table `Record<StepTag, StepHandler>`; core registers Select/Switch/Invoke + generic locals; **NDVector-specific steps move to `dsl/adapters/ndvector.steps.ts`** and register themselves via the adapter (evaluator loses its `NDVector` import).
- Payoff beyond cleanliness: serializable programs, memoization (spec §17), optimizer passes over `OpMeta` (associativity ⇒ parallel folds) all become possible.

### 2.5 Optional discipline + immutable chains — **M** · fixes V-025, V-010 (properly), V-029

- Adopt `optional.utils.ts` (move into `dsl/` or Funk proper): replace the ~30 `foldEither(o, () => null, r => r)` with `unwrapOr`/`mapOpt`/`chainOpt`; fix `oCompose` (single `get`, no `.right`); `none()` singleton; traversal extraction memoized once per Traversal.
- Tests get `expectSome(o): T` / `expectNone(o)` helpers; ban `.tag`/`.right` via ESLint `no-restricted-syntax`.
- Chains become persistent (each call returns a new chain sharing a frozen prefix) — cheap once steps are the only state.

**Acceptance:** evaluator has zero `as any` on steps and no domain imports; two NDVector adapters coexist with different lift behavior *in the same process* under test; deleting an unused adapter import changes nothing; `grep -R "\.right" dsl/ tests/` only hits `either.ts`.

---

## Phase 3 — Spec parity & the typed surface (2–4 weeks, parallelizable with late P2)

### 3.1 Implement or excise the missing axes — **M–L** · fixes V-001, V-011

- **`peers(expr?)`**: implement (replay per non-start key — trivial once 2.2 lands; the chain records its start). Port spec examples §18.2/§18.3 as tests.
- **`fork(...exprs)`**: decide. Recommendation: *delete* `MultiChain` and demote §12.4/§20 to "future work" — branch-axis is sugar over N expressions applied to one base value, achievable today with `traverse(expr)` per branch. Revisit if a real consumer needs broadcast syntax.

### 3.2 Typed surface — **L** · fixes V-012

- Factories return real types: `mapChain<Obj, D>(...) : LocalChain<Obj, D>`; `prop` constrained to `KeysOfType<Obj, D>`; start keys to `keyof Map & string`.
- `._` typed from the op registry: `OpsOf<A extends DomainAdapter<D>>` mapped type — known ops autocomplete with arity; unknown ops behind `dynamicOps` escape hatch.
- Wire `ValueKind`/`returns` (V-024) into chain state so terminal ops (Scalar/Boolean) end the domain-typed chain (spec §11), and `traverse()` infers `Traversal<number>`/`Traversal<boolean>`.
- The `*Typed` local-shape factories become real: `localSetConst("k", v)` checked against `S[K]`.

### 3.3 Spec v1.0 reconciliation — **M** · fixes drift + V-024/V-026 documentation debt

- Rewrite README against reality: specify locals, optics, `applyUsing`/`applyPartial`, strict mode, raw getters, `traverseStrict`; move unimplemented material (fork, memoization) to a clearly-marked appendix; include the strict-mode behavior table (1.5) and the conformance matrix (ARCHITECTURE §8) as living sections.
- Every normative example becomes a test file (`tests/spec/§18.1.spec.ts` …).
- Optics cleanup: merge the two `P` facades into one path API, `P()` empty-path returns identity lens or `Optional` (no throw), move `BibloOptics`/`BibloPeers` to `examples/biblo/`.

### 3.4 Debuggability (the missing UX layer) — **M** · addresses the silent-`none` experience

- `evalProgram(..., { trace })`: collect `{ stepIndex, step, outcome, reason }` per step; `chain.explain(start)` returns the trace; `none` results carry *why* (missing prop, failed guard, unknown op, threw).
- This is the single biggest developer-experience win available — Optional-first without provenance is unusable at scale, and it's ~50 lines once 2.4's dispatch table exists. Consider upgrading `Optional` to `Either<EvalError, T>` internally (Funk's `Either` already supports it — `NotFound` becomes one error variant).

---

## Phase 4 — Productization (ongoing, after P2)

| # | Item | Notes | Effort |
|---|---|---|---|
| 4.1 | Packaging: scoped name (`vex` is taken on npm), `exports`/`types`, tsup or tsc build, `sideEffects: false` (legal after 2.1) | V-032 | M |
| 4.2 | Vector modernization: prototype methods (V-027), `equals`/`toString`; **decision:** keep bespoke 2D `Vector` or re-platform it as `NDV<"x"|"y">` with a 2D facade (one vector stack instead of three) | V-027 | M–L |
| 4.3 | Funk strategy: vendor the ~90 used lines, or publish Funk as a package; drop the submodules (`concat-src` isn't imported) | V-035 | M |
| 4.4 | Property-based tests (fast-check): (a) totality — random programs over random data never throw; (b) metadata honesty — `commutative`/`associative` claims verified per adapter op; (c) axis laws — spec Appendix A equivalences | V-016 class | M |
| 4.5 | Benchmarks: chain overhead vs direct calls; Vector field-vs-prototype; traversal at 10⁵ keys (V-029) | — | M |
| 4.6 | Dead-code sweep once decisions land: `topbottom.ts` vs `TBBox` (keep one), `wrap.ts`+`empty.ts` (delete or motivate), brand id aliases (move to consumer project) | V-028 | S |
| 4.7 | Examples directory: the Biblo scenario, grid-coverage (README Appendix B) done honestly, a "build your own adapter" guide | — | M |

---

## Suggested sequence (first month)

```
Week 1:  P0 (all) + P1.1–1.8            → CI green, no silent wrong values
Week 2:  P1.9–1.12 + P2.1 (op registry) → global metadata gone
Week 3:  P2.2 (focus) + P2.3 (locals)   → structural state fixed
Week 4:  P2.4 (IR/handlers) + P2.5      → honest core; then P3 planning
```

## Open decisions (need an owner's call, cheap to decide now)

1. **Primary surface:** proxy-`._` chains (spec's story) vs locals+`applyUsing` (implementation's story)? Both can stay, but docs, typing effort (3.2), and examples should lead with one.
2. **`fork()`:** build or delete? (Recommendation: delete; see 3.1.)
3. **Error provenance:** stay pure `Optional` or move internals to `Either<EvalError, T>`? (Recommendation: Either inside, Optional at the public boundary, `explain()` for the rest — see 3.4.)
4. **Vector unification:** three vector types (`Vector`, `NDVector`, `NDV<K>`) or one core + facades? (See 4.2.)
5. **Funk:** submodule, vendored, or published dependency? (See 4.3.)
6. **What is Biblo to this repo** — the hardcoded optics suggest a real consumer with a schema; if so, its needs should drive 3.2/3.3 priorities (and its optics belong in its own package).

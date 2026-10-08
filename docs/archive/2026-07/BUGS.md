# Vex — Verified Bug & Defect Catalog

*Audit date: 2026-07-11 · Baseline: `main` @ `f54ee88` (all 20 existing tests green, `tsc --noEmit` clean — every item below is latent w.r.t. the current suite).*

**Verification method.** Each item marked **[Confirmed]** was reproduced in this audit with a temporary vitest spec written so that *green = bug present* (12/12 passed), plus a `tsc` type probe for the typing claims; the temp files were deleted after the run. Items marked **[Inspection]** are code-reading findings with the reasoning inline. Spec references are to `README.md` (v0.9).

Severity: **S1** silently produces *wrong values* or breaks an advertised API · **S2** violates a spec MUST / can throw through a total surface · **S3** inconsistency, latent hazard, dead API · **S4** hygiene/DX.

| ID | Sev | Where | One-liner |
|---|---|---|---|
| [V-001](#v-001) | S1 | `chain/base.chain.ts` | `.peers()` (spec §9.2 headline) does not exist — `TypeError` |
| [V-002](#v-002) | S1 | `op.meta.ts` + `adapters/ndvector.*` | Cross-adapter metadata contamination → `add(5)` silently returns identity |
| [V-003](#v-003) | S1 | all adapters | Import-elision silently drops side-effect op registration |
| [V-004](#v-004) | S1 | `scope/map.scope.ts:33` | Unknown focus key silently ignored → evaluates the *wrong object* |
| [V-005](#v-005) | S1 | `scope/*.ts` | `other()` with ≠2 keys silently no-ops → wrong values (spec: `none`) |
| [V-006](#v-006) | S1 | `chain/local.mixin.ts` | Chain `_local` + 8 methods are disconnected from evaluation |
| [V-007](#v-007) | S1 | `domain/domain.expr.ts:46`, `eval.ts:24` | Unvalidated `ConstD` → `add(true)` yields silent `Vector(NaN, NaN)` |
| [V-008](#v-008) | S2 | all adapters (`getMethod`) | Inherited/non-function members invokable (`._.toString()` "works") |
| [V-009](#v-009) | S2 | `traversal.ts:84`, `chain/base.chain.ts:66` | `reduceBy`/`map` throw through the MUST-NOT-throw surface |
| [V-010](#v-010) | S2 | `chain/base.chain.ts` | Chains are mutable builders — reuse silently accumulates steps |
| [V-011](#v-011) | S2 | `chain/multi.chain.ts:40` | `MultiChain.build` crashes when no `select` step (dead code) |
| [V-012](#v-012) | S2 | `chain/base.chain.ts:92-119` | All chain factories return `any` — the fluent surface is unchecked |
| [V-013](#v-013) | S2 | `eval.ts` | Strict mode honored inconsistently per step kind; `Select` resurrects |
| [V-014](#v-014) | S2 | `dsl.factory.ts` | `createDSL()` chains lack the whole locals API (divergent paths) |
| [V-015](#v-015) | S3 | `eval.ts:61` | `{ ok: false && strict }` — dead expression, contradicts its docstring |
| [V-016](#v-016) | S3 | `color.domain.ts:31` / `color.ts:5` | `Color.add` annotated commutative but isn't (alpha from `this`) |
| [V-017](#v-017) | S3 | `math/vector/ndvector.ts:12` | Constructor silently drops non-finite components |
| [V-018](#v-018) | S3 | `math/vector/vector.ts:85` | `divide` maps ÷0 to 0 silently (masks errors; inconsistent with `aspectRatio`) |
| [V-019](#v-019) | S3 | `scope/matrix.scope.ts` | Garbage keys → `NaN` focus; `W=0` → `NaN`; ragged grids; live `keys()` ref |
| [V-020](#v-020) | S3 | `expr/expr.step.ts` vs `eval.ts:108` | Declared IR union omits 10 real step kinds; evaluator runs on `as any[]` |
| [V-021](#v-021) | S3 | `eval.ts:13` | Generic evaluator imports concrete `NDVector` (layer violation) |
| [V-022](#v-022) | S3 | `eval.ts:361` | `some(undefined)` representable — "found undefined" ambiguity |
| [V-023](#v-023) | S3 | `eval.ts:227` | `applyUsing` explicit `order: []` treated as missing; unknown params ⇒ zero-arg call |
| [V-024](#v-024) | S3 | `domain/domain.adapter.ts:9` | `methodReturns` implemented by 6 adapters, consumed by nothing |
| [V-025](#v-025) | S3 | `optics.ts:18`, tests, `local.typed.ts:29` | Optional abstraction leaks: `.tag`/`.right` poked; `optional.utils.ts` unused; `oCompose` triple-evaluates |
| [V-026](#v-026) | S3 | `optics.dsl.ts` / `optics.biblo.ts` | Two colliding `P` exports; `P()` throws; app schema ("Biblo") baked into library |
| [V-027](#v-027) | S3 | `math/vector/vector.ts` | ~50 per-instance closures per `Vector`; forces the `DSL_OP_META_TABLE` workaround |
| [V-028](#v-028) | S3 | several | Dead code: `MultiChain`, `createDSL`, `Wrap`+`Empty*`, `TB` (topbottom), brand id aliases, `optional.utils.ts` |
| [V-029](#v-029) | S3 | `traversal.ts` | Re-extraction per reducer call; `anyOpt` double-materializes; spread-based min/max |
| [V-030](#v-030) | S4 | `package.json` | `typescript` missing from devDependencies (documented workflow can't run) |
| [V-031](#v-031) | S4 | `package.json` | `test` script is watch-mode `vitest` (hangs CI) |
| [V-032](#v-032) | S4 | `package.json` | No `main`/`exports`/`types` — library is unconsumable as a package |
| [V-033](#v-033) | S4 | `tsconfig.json` | `include:["./"]` — would re-include `dist/` after a first emit; compiles submodule |
| [V-034](#v-034) | S4 | repo root | Stale `out.txt`/`test.out.txt` committed; stray `dsl/Vex.code-workspace`; filename with spaces |
| [V-035](#v-035) | S4 | `.gitmodules` | SSH-only submodule URLs; fix currently sitting uncommitted |
| [V-036](#v-036) | S4 | repo | No CI, no lint, no format config |
| [V-037](#v-037) | S4 | `tests/` | Tautological assertion; a "DSL" spec that never calls the DSL; coverage gaps (see ARCHITECTURE §9) |
| [V-038](#v-038) | S1 | `domain/domain.expr.ts` (`normalizeArgs`) | String args are always `PropRef`, 2-string arrays always `OfRef` → string/array-parameter methods unreachable *(added 2026-10-08)* |
| [V-039](#v-039) | S2 | `domain/domain.expr.ts` (`domainExpr`) | Catch-all Proxy records `build` (spec §9.3 API) as an op; `select`/`identity` shadow domain ops *(added 2026-10-08)* |
| [V-040](#v-040) | S1 | `eval.ts` (Switch/Self) | `self()` with no key is a no-op → cannot return to the start after `other()` *(added 2026-10-08)* |
| [V-041](#v-041) | S2 | `domain/domain.expr.ts` (`domainExpr`) | Expressions are thenables: `await expr` never settles and appends a `then` step *(added 2026-10-08)* |
| [V-042](#v-042) | S1 | `chain/base.chain.ts` (v0 `peers`) | The peer axis was never correct: v0 `peers()` returned 0 for every peer in §18.2 (focus clobbering) *(added 2026-10-08)* |

---

## S1 — Silent wrong values / broken advertised API

<a id="v-001"></a>
### V-001 · `.peers()` does not exist — [Confirmed]

The peer axis is one of the spec's four orthogonal axes (§12.3) and appears in the surface API (§9.2), the EBNF (§19), and two of three normative examples (§18.2, §18.3). No implementation exists on `BaseChain` or the `withLocal` mixin.

```ts
vectorMapChain({ A, B }).prop("position").peers()   // TypeError: chain.peers is not a function
```

**Fix:** implement as a sibling of `traverse()` — iterate `scope.keys()` excluding the current start (the chain must remember the last `value(start)`/explicit start), replay the program per peer, optionally post-apply the expr. → ROADMAP P3.1.

<a id="v-002"></a>
### V-002 · Op-metadata cross-contamination between adapters — [Confirmed]

`annotateOp` writes `OpMeta` onto the domain class's prototype (or its methods) — *global mutable state*. `NDVectorAdapter` (`ndvector.domain.ts`) and `LiftedNDVectorAdapter` (`ndvector.adapter.lifted.ts`) both annotate `NDVector.prototype`; the lifted module sets `liftScalar: true` on `add/subtract/multiply/dot`. Whichever modules are loaded, **their union governs every adapter** using that class.

Confirmed evaluation trace (both adapter modules imported, plain adapter used):

```
meta on NDVector.prototype.add: { commutative: true, associative: true, liftScalar: true }  ← contaminated
plain adapter add(5):  {"tag":"Right","right":{"x":1}}        ← SILENT IDENTITY (wrong value)
lifted adapter add(5): {"tag":"Right","right":{"x":1,"scalar":5}}  ← intended lifted behavior
direct add(5) threw:   "Cannot convert undefined or null to object" ← what plain would do uncontaminated (→ none)
fromScalar(5) plain:   {}                                      ← data loss
```

Three compounding defects: (a) metadata is shared per-class, not per-adapter; (b) plain `NDVectorAdapter.fromScalar` returns `new NDVector({})`, *discarding its argument*, so the contaminated lift turns `add(5)` into `add(∅)` = identity; (c) the result depends on import order/presence — the same line of code returns `Right(identity)` or `Left` depending on whether an unrelated module was ever imported.

**Fix:** move op metadata (and params/returns) into the adapter itself (`ops: Record<string, OpDescriptor>`); delete prototype writes and `DSL_OP_META_TABLE`; remove `fromScalar` from the plain NDVector adapter (absent `fromScalar` = lift is a no-op per §13, and `add(5)` then correctly ⇒ `none`). → ROADMAP P2.1.

<a id="v-003"></a>
### V-003 · Adapter registration is an import side effect — elided by the toolchain — [Confirmed]

All adapters run `annotateOp` in module-level IIFEs, so behavior depends on the *import* happening. TypeScript/esbuild **elide imports whose bindings are unused** — during this audit, `import { LiftedNDVectorAdapter } from …` with an unused binding was dropped by vitest's esbuild transform and the annotations never ran, flipping V-002's observable behavior. Any consumer that imports an adapter only for types (`import type` semantics inferred), or a bundler with aggressive tree-shaking (`sideEffects: false`), silently loses scalar-lift metadata.

**Fix:** same as V-002 — make registration data owned by the adapter object; no import-time side effects. (Interim mitigation: `import "…/ndvector.adapter.lifted"` bare imports.)

<a id="v-004"></a>
### V-004 · Unknown focus key silently keeps old focus — [Confirmed]

`map.scope.ts:33`: `setFocusByKey: (k) => { const i = keys.indexOf(k); if (i >= 0) idx = i; }` — a miss leaves focus unchanged and evaluation proceeds against whatever was focused before. Spec §4.2/§8: invalid switches MUST make dependent evaluation `none`.

```ts
vectorMapChain({ A, B }).self("NO_SUCH_KEY").prop("position").value("A")
// → Right(A.position)   — plausible-looking wrong answer, not none
```

Same for `setFocusByIndex` out-of-range. Because `PropRef`/`Select` resolve focus-relative, this class of bug produces *numbers that look right* — worst-case failure mode. **Fix:** poisoned-focus state (or `Optional<Scope>`): any read after a failed switch ⇒ `none`. → ROADMAP P1.2/P2.2.

<a id="v-005"></a>
### V-005 · `other()` outside a pair silently no-ops — [Confirmed]

`map.scope.ts:35` flips only `if (keys.length === 2)`; `matrix.scope.ts:37` is an empty function. Spec §8 (MapScope): otherwise it "MUST cause subsequent evaluation to become `none`"; MatrixScope: "MUST cause `none` if invoked without an explicit key".

```ts
vectorMapChain({ A, B, C })
  .prop("position")._.add("size").other()._.subtract("position").value("A")
// → Right(size)   — subtracted A's own position; spec requires none
```

**Fix:** with V-004's poisoned-focus mechanism, `setFocusToOther()` poisons unless `|keys| === 2`. → ROADMAP P1.2.

<a id="v-006"></a>
### V-006 · The chain-side locals API is disconnected from evaluation — [Confirmed]

`withLocal` maintains `this._local: LocalMap` and exposes `getLocal / adoptLocal / localFor / localRename / localRemove / localProject / localMerge / localClear / localRequire` against it. But `evalProgram` (`eval.ts:93`) starts every run with `let local = new LocalMap()` and never receives the chain's `_local`. Only the *step*-based writers (`localSetConst/Prop/Of/Expr/Lens/Optic/NDV*`) affect evaluation.

Confirmed both directions:

```ts
c.prop("position").localSetConst("k", 2).applyUsing("scale", ["k"]);
c.value("A");                 // Right — steps work
c.getLocal().get("k");        // none — the "official" map never saw k

c._local = c._local.set("k", { tag: "scalar", value: 2 });  // what adoptLocal does
c.prop("position").applyUsing("scale", ["k"]).value("A");   // Left — eval ignores _local
```

Eight public methods are no-ops w.r.t. evaluation; `localRequire` validates a map that isn't the one used. **Fix:** delete the field-based API or make `_local` the evaluator's seed (and reimplement rename/remove/project as steps). → ROADMAP P2.3.

<a id="v-007"></a>
### V-007 · `ConstD` is never validated — silent NaN poisoning — [Confirmed]

`normalizeArgs` (`domain.expr.ts:46`) classifies any non-number/non-string/non-expr/non-pair argument as `ConstD`, and `evalArg` (`eval.ts:24`) returns `some(a.v)` without the `isInstance` check the spec demands (§3.2 note: "`isInstance` guards at invocation").

```ts
vectorMapChain({ A }).prop("position")._.add(true).value("A")
// → Right(Vector { x: NaN, y: NaN })   — true.x is undefined; 1 + undefined = NaN; nothing throws
```

Booleans, `null`, and arbitrary objects ride through and either throw inside the method (caught → `none`, acceptable) or — as with `Vector` — produce NaN values wrapped in `some`. **Fix:** in `evalArg`, `ConstD` ⇒ `adapter.isInstance(v) ? some(v) : none()`. One line. → ROADMAP P1.1.

---

## S2 — Spec MUST violations / throwing surfaces / API traps

<a id="v-008"></a>
### V-008 · `getMethod` returns inherited and non-function members — [Confirmed]

Every adapter implements `getMethod` as `(self as any)[name]`, so `Object.prototype` members and data fields pass the `if (!method)` check in `eval.ts:337`.

```ts
vectorMapChain({ A }).prop("position")._.toString().value("A")
// → Right("[object Object]")   — spec §7.1: unknown names MUST return undefined ⇒ none
```

Non-function properties reach `method.apply` and throw (caught → `none`) — total, but by accident. **Fix:** shared helper `methodOf(self, name)` that requires `typeof === "function"` and ownership on the domain prototype chain (not `Object.prototype`), or — better — resolve through the adapter op registry of P2.1. → ROADMAP P1.3.

<a id="v-009"></a>
### V-009 · `reduceBy`/`map` throw through the "MUST NOT throw" surface — [Confirmed]

Spec §6: surfaces (`value`, `traverse`, `peers`, `reduceBy`) MUST NOT throw. But the `invoke` closure `traverse()` hands to the traversal (`base.chain.ts:66`) calls the method directly — no adapter, no metadata, **no try/catch** — and `Traversal.map/fold/sum/...` apply user projections unguarded.

```ts
mapChain(TBAdapter, { A: {t: TBBox.top(3)}, B: {t: TBBox.top(4)} })
  .prop("t").traverse().reduceBy("chain")
// → throws TypeError ("f is not a function") — TBBox.chain called with a TBBox as f
```

Also note `reduceBy` bypasses scalar-lift metadata entirely, so `reduceBy("add")` and `._.add(...)` disagree about lifting. **Fix:** wrap `invoke` and reducer projections in try/catch → `none`/skip; route `invoke` through `adapter.getMethod` + meta. → ROADMAP P1.4.

<a id="v-010"></a>
### V-010 · Chains are mutable builders — reuse silently changes results — [Confirmed]

`._`, `prop`, `self`, `other`, `localSet*` all push into the same `steps` array; `build()` copies the array *at build time* but the chain remains open.

```ts
const c = vectorMapChain({ A, B }); c.prop("position");
c._.add("size").value("A")   // (4,6)
c._.add("size").value("A")   // (7,10) — same source line, different result
```

`domainExpr()` proxies have the same property (retained references keep accumulating steps). **Fix (minimal):** freeze on first `build()`/`value()`/`traverse()` and throw-or-warn on later pushes; **fix (proper):** persistent/copy-on-write chains returning new instances. → ROADMAP P2.5.

<a id="v-011"></a>
### V-011 · `MultiChain.build` crashes on select-less programs — [Inspection, dead code]

`multi.chain.ts:40`: `scope.getPropOpt((base.find(s => s.t === "select") as any).prop)` — if no `Select` exists, `.find` returns `undefined` and property access throws `TypeError`, violating §4.1 ("MUST return none"). Currently unreachable — nothing constructs `MultiChain` (no `fork()` anywhere) — but it's a landmine for whoever wires it up. Also redundant: it passes the selected prop as `initial` *and* replays the base program (which re-selects anyway). **Fix:** guard → `none`, or delete the class until `fork()` is actually built. → ROADMAP P3.1.

<a id="v-012"></a>
### V-012 · The entire chain surface is `any`-typed — [Confirmed via tsc probe]

`mapChain/arrayChain/matrixChain` (and `*Typed` variants) return `new (Chain as any)(…)` with no annotation — TypeScript infers `any`. All three of these **compiled without error** under the project's strict tsconfig:

```ts
const t1: number = mapChain(VectorAdapter, { A });                    // any assigned to number
const t2 = vectorMapChain({ A }).thisMethodDoesNotExist(42).prop(123); // nonsense accepted
const t3 = arrayChain(VectorAdapter, [A]).prop("definitely-not-a-vector-prop");
```

So `KeysOfType` (`lenses.ts`) — built exactly to constrain `prop` — is never applied, the `withLocal<…, S>` shape parameter is decorative, and typos surface only as runtime `none`s (or `TypeError`s, V-001). This interacts viciously with Optional-first totality: *the type system doesn't catch mistakes and the runtime silently maps them to `none`* — nothing ever tells you where you went wrong. **Fix:** typed factory returns + `prop: KeysOfType<Obj,D>` + typed `._` surface. → ROADMAP P3.2.

<a id="v-013"></a>
### V-013 · Strict mode is honored inconsistently per step — [Inspection]

Observed behavior matrix of `evalProgram(opts.strict = true)`:

| Step | On failure |
|---|---|
| `local:set*` (no scope / miss) | `return none()` ✔ |
| `local:apply` (order/shape/args/self/method) | `return none()` ✔ |
| `local:partial` (throw) | swallowed: `catch { if (strict) return none(); }` — but **non-strict continues with no local written and `cur` untouched** |
| `Select` miss | `return none()` ✔ |
| `Switch` invalid | **never fails** (V-004/V-005) |
| `Invoke` on `none`/non-domain | `cur = none(); continue` — **not** a strict return; a later successful `Select` *resurrects* the pipeline even in strict mode |
| `Invoke` arg `none` | `return none()` ✔ |
| `Invoke` method throws | `cur = none()` — continues in strict mode |

**Fix:** define strict semantics once ("first `none` is final") and enforce uniformly (one helper: `fail(strict)`), with a behavior table in the spec. → ROADMAP P1.5.

<a id="v-014"></a>
### V-014 · `createDSL()` builds chains without the locals surface — [Confirmed]

`dsl.factory.ts` constructs `new BaseChain(...)` directly; the factory functions in `base.chain.ts` wrap with `withLocal`. Confirmed: `createDSL(VectorAdapter).mapChain({A}).localSetConst` is `undefined`. Two construction paths, two different APIs, and the facade intended as the public entry point is the crippled one (also: unused by anything). **Fix:** route `createDSL` through the same factories (or delete it). → ROADMAP P1.6.

---

## S3 — Correctness hazards, inconsistencies, dead API

<a id="v-015"></a>
### V-015 · `validateLocalShape` dead expression
`eval.ts:61`: `return isFound(ok) ? { ok: true } : { ok: false && strict };` — `false && strict` is constant `false`; the docstring ("in non-strict mode return `false` on mismatch") contradicts the code shape. Behavior today: shape mismatch always fails the apply (both modes). Decide the intended lenient behavior and write it down; delete the dead `&& strict`.

<a id="v-016"></a>
### V-016 · `Color.add` breaks its advertised commutativity
`color.ts:5` keeps `this.a`, so `a.add(b) ≠ b.add(a)` whenever alphas differ, but `color.domain.ts:31` annotates `add` as `commutative: true`. §14 makes such annotations a conformance warranty (they license reordering in folds). Fix the annotation or make alpha handling symmetric.

<a id="v-017"></a>
### V-017 · `NDVector` silently drops non-finite components
`ndvector.ts:12`: `Infinity`/`NaN` values are *removed* in the constructor, so `new NDVector({x: Infinity}).get("x") === 0` and `v.scale(Infinity)` collapses to the zero-ish vector. Reasonable as a sanitization policy, but silent and undocumented; interacts oddly with `clamp()`'s ±Infinity defaults. Document, or preserve-and-poison (`none` at DSL level).

<a id="v-018"></a>
### V-018 · `Vector.divide` maps ÷0 to 0
`vector.ts:85` returns 0 for any zero divisor (`0/0` and `5/0` alike), silently corrupting downstream math (e.g., the README's own grid-coordinate example §Appendix-B with cell size 0). Meanwhile `aspectRatio` chose `Infinity` for the same situation — two conventions in one class. Recommend: real division (Infinity/NaN propagate) + DSL-level guard, or an explicit `divideSafe`.

<a id="v-019"></a>
### V-019 · MatrixScope edge cases
`matrix.scope.ts`: `setFocusByKey("A")` → `[i,j] = [NaN, undefined]`, `currentKey()` → `"NaN,undefined"` (no poisoning, V-004 applies); `setFocusByIndex` with `W=0` → `NaN` division; ragged grids assumed rectangular from row 0; `keys()` returns the **live internal array** (MapScope returns a copy) — caller mutation corrupts the scope.

<a id="v-020"></a>
### V-020 · The declared IR is a fiction
`Step<D>` (`expr.step.ts:22`) declares 3 step kinds; the evaluator handles 13 (ten `local:*` kinds pushed via `as any` from `local.mixin.ts`). `DomainExpr.build(adapter)` claims `Step<D>[]` while carrying the rest. Exhaustiveness checking, serialization, memoization (§17), and any future optimizer are impossible until the union is honest. → ROADMAP P2.4.

<a id="v-021"></a>
### V-021 · Evaluator imports a concrete math class
`eval.ts:13` imports `NDVector` to implement `local:setNDVFrom*` — the domain-agnostic core now hard-depends on one domain (spec §2: layers MUST be independent). Extract these steps into a pluggable step-handler (registered by the NDVector adapter/module). → ROADMAP P2.4.

<a id="v-022"></a>
### V-022 · `some(undefined)` is representable
`eval.ts:361` wraps any method return in `some(...)`; a void method (e.g. `Vector.traverseGridTo`) yields `Right(undefined)` — "found nothing", which downstream code can't distinguish from a meaningful value. Decide: normalize `undefined → none` (Funk's `nullable`) at the invoke boundary, or forbid void ops.

<a id="v-023"></a>
### V-023 · `applyUsing` order-resolution warts
`eval.ts:227`: explicit `order: []` is indistinguishable from "no order" (`!order || order.length === 0`) and falls back to adapter params; an op with *unknown* params (adapter returns `[]` by the "always return an array" convention) resolves to a **zero-argument call** rather than a failure — a method needing args gets invoked with none (throw → `none`, losing the real cause). The `[]`-means-unknown convention conflates "no params" with "don't know".

<a id="v-024"></a>
### V-024 · `methodReturns` is a dead API
Declared on the interface, implemented by all six adapters, referenced by spec §11 — and read by zero lines of runtime or type code. Either consume it (terminal-kind checking, typed traversals) or drop it. → ROADMAP P3.3.

<a id="v-025"></a>
### V-025 · Optional discipline violations (the spec's own checklist item 1)
- `optional.utils.ts` — the spec-mandated combinator layer — has **no importers**; `eval.ts` hand-rolls `foldEither(o, () => null, r => r)` ~30×.
- `optics.ts:18-23` (`oCompose`) reaches into `(x as any).right` and re-evaluates `ab.get(a)` up to 3× per get/set.
- `local.typed.ts:29` and `local.mixin.ts:98` branch on `.tag === "Right"` instead of `isFound`.
- Every test file reads `.tag`/`.right` raw (no `expectSome` helper).

<a id="v-026"></a>
### V-026 · Optics facade issues
Two exported `P`s with different shapes (`optics.dsl.ts` single-key lens vs `optics.biblo.ts` variadic path) — pick-the-wrong-import compiles and misbehaves. `optics.biblo.ts:P()` **throws** on zero keys (the only throwing API in an Optional-first library). `BibloOptics`/`BibloPeers` hardcode an application's schema into the library — belongs in `examples/`.

<a id="v-027"></a>
### V-027 · `Vector` allocates ~50 closures per instance
Every method is a `public foo = (…) => …` field: ~50 function allocations per `Vector` (a hot type in any geometry workload), no prototype methods (which forced the `DSL_OP_META_TABLE` fallback mechanism into existence), inconsistent with every other domain class. Mechanical fix: convert to prototype methods; `annotateOp` then attaches directly. Also unused oddities: `conjugate`, `traverseGridTo` (imperative visitor with non-integer-input infinite-ish loops).

<a id="v-028"></a>
### V-028 · Dead code inventory
`chain/multi.chain.ts` (no `fork()`), `dsl.factory.ts` (`createDSL` — unused and broken, V-014), `monads/topbottom.ts` (duplicate of TBBox as tagged union), `monads/wrap.ts` + `algebra/empty.ts` (Wrap/Empty applicative — only importer is each other), `brand.ts` NodeId/EdgeId/LayoutId aliases (graph-project leftovers), `optional.utils.ts` (V-025). Roughly ~15% of non-test source is unreachable from any used entry point.

<a id="v-029"></a>
### V-029 · Traversal inefficiencies
`extract(xs)` re-materializes on every reducer call; `anyOpt`-family calls `toArray()` twice per invocation; `min/max` spread into `Math.min(...)` (stack limits on ~100k elements); `none()` in Funk allocates a fresh object per call (could be a frozen singleton). All trivial to fix; none urgent.

---

## S4 — Hygiene / DX

<a id="v-030"></a>
### V-030 · `typescript` absent from devDependencies
`commands ie. update-submodules.txt` documents `tsc --noEmit > out.txt`, but a fresh clone has no `tsc` (`npx tsc` resolves to the wrong package and fails). Add `typescript` to devDependencies and a `typecheck` script.

<a id="v-031"></a>
### V-031 · `npm test` = watch mode
`"test": "vitest"` starts the watcher (the committed `test.out.txt` even captures it: "Watching for file changes..."). Use `vitest run` for `test`, `vitest` for a `test:watch` script.

<a id="v-032"></a>
### V-032 · Package is unconsumable
`private: true` with no `main`/`module`/`exports`/`types`/`files` and no build output. Fine for a lab; blocks any consumer (including the user's other projects — e.g. whatever "Biblo" is). Decide on the packaging story. Note the npm name `vex` is taken (music notation engraver) — pick a scoped name.

<a id="v-033"></a>
### V-033 · tsconfig latent trap
`include: ["./"]` + `outDir: "dist"` + `declaration: true`: the first real `tsc` emit will create `dist/`, and the *second* compile re-includes `dist/**/*.d.ts` → duplicate-symbol errors. Also compiles `external/` submodules under root settings. Add `exclude: ["dist", "node_modules"]` (and consider excluding `external` once Funk is a dependency).

<a id="v-034"></a>
### V-034 · Stray files
Committed stale build/test logs (`out.txt`, `test.out.txt` — both reflect a fixed, older state and now mislead), `dsl/Vex.code-workspace` (editor artifact inside source), `commands ie. update-submodules.txt` (spaces in filename; belongs in a `justfile`/`Makefile`/`docs/DEV.md`).

<a id="v-035"></a>
### V-035 · Submodule friction
SSH-only URLs (unbuildable for HTTPS/CI users without key setup); the `.gitmodules` host fix (`github.com-personal` → `github.com`) is sitting uncommitted in the working tree right now. Only ~90 lines of Funk are used (V-025) — vendor or publish it. `external/concat-src` isn't imported by anything.

<a id="v-036"></a>
### V-036 · No CI / lint / format
No GitHub Actions (or any CI), no ESLint, no Prettier/dprint config. Given how many of the S1 items are *silent* wrong-value bugs, a CI gate of `typecheck + vitest run` is the single highest-leverage hygiene item.

<a id="v-037"></a>
### V-037 · Test-suite quality
`dsl.angle.spec.ts:24` asserts `res.tag === "Left" || res.tag === "Right"` (always true); `dsl.composite.spec.ts` claims to demo the DSL but is plain TS; the spec's normative examples (§18.1–18.3) exist nowhere as tests (§18.1 needs `._`+`other()` — both untested; §18.2/18.3 need `.peers()` — unimplemented). Coverage inventory in ARCHITECTURE §9.

---

## Added 2026-10-08 (review: [REVIEW.md](../../REVIEW.md))

All five reproduced with temporary specs (deleted after the run). V-042 was reproduced by extracting commit `47e15ce` and running it with a local adapter, because v0's own Vector adapter throws at import (`annotateOp: 'add' is not a function`).

<a id="v-038"></a>
### V-038 · Argument normalization makes string-parameter methods unreachable — [Confirmed] · S1
`normalizeArgs` maps every string to `PropRef` and every `[string, string]` array to `OfRef`. There is no way to pass a string or array *literal*.

```ts
const A = { v: new NDVector({ x: 1, y: 2, z: 3 }) };
A.v.pick(["x", "y"]).toJSON();                                   // {x:1, y:2}
mapChain(NDVectorAdapter, { A }).prop("v")._.pick(["x","y"]).value("A");  // none — read field "y" of object "x"
mapChain(NDVectorAdapter, { A }).prop("v")._.get("x").value("A");         // none — read field "x" of the focus
```
**Fix:** explicit argument constructors (`lit`, `of`, `field`) and typed parameters; a bare string is a field reference that the types check against the object's keys. → REVIEW §6.6.

<a id="v-039"></a>
### V-039 · `domainExpr` Proxy namespace collision — [Confirmed] · S2
The Proxy `get` trap intercepts every property except `__isDomainExpr`, `_expr`, `select`, `identity`. The spec's own API `expr.build(adapter)` (§9.3) is therefore recorded as an op:

```ts
vectorExpr().build(VectorAdapter)   // steps: [{ t: "invoke", op: "build", args: [ConstD(VectorAdapter)] }]
```
Callers must reach `._expr.build(adapter)`. Domain ops named `select` or `identity` cannot be invoked. **Fix:** no catch-all proxies; ops live only under a typed `._` namespace. → REVIEW §6.6.

<a id="v-040"></a>
### V-040 · `self()` without a key is a no-op — [Confirmed] · S1
`BaseChain.self()` pushes `Switch(Self, undefined)`; the evaluator only moves focus for a string/number key. After `other()`, `self()` does not return to the start, so later relative refs silently read the other object:

```ts
vectorMapChain({ A, B }).prop("position").other().self()._.add("size").value("A")
// → A.position + B.size   (intended: A.position + A.size)
```
**Fix:** track the origin; `origin()` resets the address. → REVIEW §6.2.

<a id="v-041"></a>
### V-041 · Expressions are thenables — [Confirmed] · S2
The catch-all `get` trap returns a function for `then`, so the expression proxy looks like a Promise. `await expr` (or returning an expr from an `async` function) calls `then(resolve, reject)`, which records an `Invoke("then")` step and never settles:

```ts
await vectorExpr().add("size");     // hangs forever; the steps become ["add", "then"]
```
**Fix:** same as V-039 (tRPC's proxy guards `then`, `toJSON`, `valueOf`, `toString`; Vex's new builder has no catch-all proxy).

<a id="v-042"></a>
### V-042 · The peer axis was never correct — [Confirmed] · S1
V-001 says `peers()` is missing. The history adds: it existed in v0 (`47e15ce`) and was removed in `b95eddb`, but v0's version was wrong for the spec's own examples. The base program begins with `self("A")`, which moves the shared focus back to A for every peer, and the peer expression then reads A's fields:

```
v0, spec §18.2: peer results [0, 0, 0], min 0          (intended: distances to B, C, D; min 1 for the test data)
v0, spec §18.3: reduceBy("add") → (0, 0)               (intended: (A−B) + (A−C) = (−9, −12))
```
Restoring v0's `peers()` (as V-001's fix suggests) is therefore not enough. The axis needs two positions at once: the origin (where the base runs) and the target (where the peer expression reads). **Fix:** focus as a value plus addresses resolved at build time. → REVIEW §6.2–6.3.

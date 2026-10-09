<!-- ste-disable -->
> **Raw research report (2026-10-08).** Research: theory and prior art (Store comonad, spreadsheets, typed builders, errors, laws, registries). A research agent of the 2026-10-08 review wrote this report. It is kept verbatim as evidence. The synthesis and the decisions are in [../REVIEW.md](../REVIEW.md). This file is not STE text.

# Vex: prior art, theory, and redesign ideas (research report)

Research date: 2026-10-08. About 70 distinct sources were consulted, mostly primary: specs, official docs, source files, and papers. I read the full text of several PDFs (Ahman-Chapman-Uustalu, Gibbons-Wu, Oliveira-Cook). Every claim below links to its source. Two things are my own synthesis and are labelled that way: the mapping between R1C1 addressing and directed containers, and every "What this means for Vex" recommendation. Items I could only check through secondary sources are marked **[secondary]**.

I also built and checked two small scratch prototypes. They live in the session scratchpad and are not in any repo:
- a scratch file (now `docs/spikes/typed-chain.ts`) is a typed `defineDomain` plus a typed `._` proxy plus a type-state chain. It type-checks under TypeScript 5.9.3 `--strict` with zero errors, and all 10 `@ts-expect-error` negative cases fire as expected.
- `...\scratchpad\sketch\store-laws.ts` is an immutable Store comonad over a keyed collection, with randomized law checks. All the comonad, Store and Vex-specific laws held on 2,000 random cases.

---

## Summary

1. **Formally, Vex's scope is the Store comonad.** A keyed collection with a focus key is `Store K X = (K -> X) x K`. Equivalently, it is the "focussed container" of Ahman, Chapman and Uustalu, and their paper proves such containers are comonads. Mapped onto Vex: `traverse` = `extend`, `self(k)` = `seek`, `peers` = `experiment(k => keys \ {k})`, a relative `PropRef` = `extract`, and an absolute `[key, prop]` = `peek`. This gives laws you can property-test directly (§1).
2. **Spreadsheets are the right user-facing mental model.** Excel's relative and absolute references (R1C1 notation) are exactly Vex's `PropRef` and `OfRef`. Excel error values (#REF!, #N/A, #VALUE!, #NAME?, and so on) are a proven design for failures that are values and propagate. "Build Systems à la Carte" adds a point that matters for layout: keeping references as data (static, applicative dependencies) is what enables incremental recalculation.
3. **TypeScript can fully type `._`.** The proven pattern is tRPC's: an untyped runtime Proxy, cast to a mapped type computed from a type-level registry. Kysely and ts-pattern add the type-state pattern (each call returns a builder type that may differ). The prototype confirms this works for Vex at negligible type-check cost.
4. **Errors:** keep `Optional` only at the public boundary. Internally use `Result<T, VexError>` with Excel-like codes, accumulate argument errors applicatively, and add an `explain()` modelled on PostgreSQL's EXPLAIN ANALYZE.
5. **Algebraic metadata is only trustworthy if it is checked.** Every serious system that relies on commutativity or associativity either proves it (Halide) or documents "unspecified results if violated" (Futhark, Spark). Libraries check laws with property tests (cats/discipline, Algebird, fp-ts-laws). Such a test would have caught the audit's V-016 immediately.
6. **Registries:** use dictionaries owned by the domain value (static-land style), not prototype methods (fantasy-land style) and not import side effects. TypeScript 7 (GA July 2026) makes type-heavy APIs cheaper in the editor but has no compiler API until 7.1.
7. **Niche:** nothing found combines (a) user-supplied domain adapters, (b) a typed fluent chain, (c) spreadsheet-style relative and absolute references over keyed collections, (d) total evaluation with explanation, and (e) law-checked algebraic metadata. The nearest neighbours are Excel LAMBDA/BYROW, SQL window functions and Vega-Lite's window transform, comonadic stencil DSLs (Ypnos, Foner), Effect Schema ("one description, many compilers"), and grammar-to-fluent-API generators (Fling, TypeLevelLR).

---

## 1. Theory that reframes Vex

### 1.1 Is "focus + peers + traverse over a keyed collection" a comonad or zipper? Yes: it is the Store comonad.

**Key findings**
- A comonad has `extract :: w a -> a`, `duplicate :: w a -> w (w a)` and `extend :: (w a -> b) -> w a -> w b`. Its laws are usually stated in Cokleisli form: `f =>= extract = f`, `extract =>= f = f`, and associativity of `=>=` ([Hackage `Control.Comonad`](https://hackage-content.haskell.org/package/comonad-5.0.10/docs/Control-Comonad.html)).
- The Store interface is `pos :: w a -> s`, `peek :: s -> w a -> a`, `peeks`, `seek`, `seeks`, and `experiment :: Functor f => (s -> f s) -> w a -> f a` ([Hackage `ComonadStore`](https://hackage-content.haskell.org/package/comonad-5.0.10/docs/Control-Comonad-Store-Class.html)). `experiment` (a function from the focus to a functor of other positions) is exactly the shape of `peers()` and of a future `neighbors()`.
- For a representable functor `g`, "The representation of that Functor serves as the index of the store". This is useful when the functor memoizes its contents and "will be inspected often" ([adjunctions, Representable Store](https://hackage-content-origin.haskell.org/package/adjunctions-4.4.3/docs/Control-Comonad-Representable-Store.html)). A functor is Representable when `tabulate` and `index` witness an isomorphism with `(->) x` ([`Data.Functor.Rep`](https://hackage-content.haskell.org/package/adjunctions-4.4.4/docs/Data-Functor-Rep.html)). Vex's three scopes (record, array, matrix) are representable containers over a finite key type: `K`, `Fin n`, and `Fin m x Fin n`.
- Ahman, Chapman and Uustalu define *directed containers* (shapes, positions, a subshape at each position, a root, and position translation). They prove that "directed containers are the same as containers that are comonads". Their examples include "data-structures with a designated position (zippers)" ([LMCS 10(3:14) 2014](https://lmcs.episciences.org/894/pdf), DOI 10.2168/LMCS-10(3:14)2014). Their **focussing** construction (§4.5) maps directly onto Vex:
  - Any container becomes comonadic once you add a focus.
  - The shape is the pair (shape proper, focus).
  - The positions are the positions of the shape proper.
  - Moving to position p' changes only the focus.
  - The root is the focus.
  - Translation is the identity.
  So a `Record<K, Obj>` plus a focus key is a lawful comonad by construction.
  Their list-zipper example (Example 4.7) uses *relative* positions `{-s0..s1}`, with translation `p (+) p' = p + p'`.
- **My synthesis (not stated in the paper):** absolute addressing (A1 `$B$2`, Vex `["B","size"]`) corresponds to the focussed container, whose translation simply ignores the old position. Relative addressing (R1C1 `R[-1]C`) corresponds to zipper-style offset positions, where translation is a monoid action (`+`).
- Huet's zipper (JFP 7(5) 1997, DOI 10.1017/S0956796897002864, [PDF](http://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf)) is the data-structure view: focus plus context, with constant-time local moves ([Panchekha's summary](https://pavpanchekha.com/blog/zippers/huet.html)). Store is the function view of the same idea. For Vex the function view is simpler, because collections are already indexable.
- Cellular automata are the canonical example. Piponi applies a local rule everywhere with `u =>> rule`, where `cojoin` builds "a 'universe' of 'universes'". He notes that "large datastructures pieced together from lots of small but similar computations" signal a comonad ([sigfpe 2006](http://blog.sigfpe.com/2006/12/evaluating-cellular-automata-is.html)). Capobianco and Uustalu identify the local behaviours of cellular automata with coKleisli maps of the exponent comonad and recover the Curtis-Hedlund theorem ([arXiv:1012.1220](https://arxiv.org/abs/1012.1220)). Stencil and grid DSLs use the same semantics: Ypnos's semantics is comonadic ([Orchard, Bolingbroke, Mycroft, DAMP'10](https://www.cs.kent.ac.uk/people/staff/dao7/publ/ypnos-damp10.pdf)).
- Uustalu and Vene, "Comonadic Notions of Computation" (ENTCS 2008, DOI 10.1016/j.entcs.2008.05.029) and "The Essence of Dataflow Programming" (DOI 10.1007/11575467_2). Their zipper-comonad treatment of attribute grammars, where a node's attributes depend on its context, is described in [Uustalu's 2005 post](https://mail.haskell.org/pipermail/haskell/2005-September/016505.html). **[secondary: I did not read the TFP paper itself.]**
- Store also underlies optics. Lawful lenses are coalgebras of the costate (store) comonad ([nLab: lens](https://ncatlab.org/nlab/show/lens+%28in+computer+science%29); [Gibbons and Johnson, "Relating Algebraic and Coalgebraic Descriptions of Lenses"](https://www.cs.ox.ac.uk/publications/publication4599-abstract.html)). So Vex's scope layer and its optics layer are the same mathematics.

**Vex concept to Store operation**

| Vex | Store / comonad | Note |
|---|---|---|
| focused scope | `Focused<K,O> = { space, pos }` | must be an immutable value |
| `.prop(p)` on the focus, `PropRef(p)` | `extract` then project | relative reference |
| `["B","size"]` (`OfRef`) | `peek("B")` then project | absolute reference |
| `self(k)` | `seek(k)` | `k` not in keys must give #REF!, never silently keep the old focus (V-004) |
| `other()` | `seeks(swap)` | partial: defined only when there are exactly 2 keys (V-005) |
| `traverse(p)` | `extend(p)` | should return a *keyed space*, not a bare list |
| `peers(p)` | `experiment(k => keys\{k}, extend p)` | = jQuery `.siblings()`, = SQL `EXCLUDE CURRENT ROW` |
| `fork(p, q)` | product of coKleisli arrows `w => [p(w), q(w)]` | always well defined |
| array or matrix neighbour refs | `peeks(i => i+1)`, `(i,j) => (i-1,j)` | R1C1 relative; needs a boundary policy |
| `traverse` then `traverse` | coKleisli composition `=>=` | enables multi-pass programs |

**Laws to property-test.** All of these held in my prototype (`store-laws.ts`, 2,000 random cases):
- `extend(extract)(w) == w`. Running the identity program everywhere gives back the collection with the focus unchanged.
- `extract(extend(p)(w)) == p(w)`. A traversal read at the focus equals a single run.
- `extend(f)(extend(g)(w)) == extend(v => f(extend(g)(v)))(w)`. Two-pass programs compose.
- Store laws: `peek(pos w) w == extract w`, `pos(seek s w) == s`, `seek s . seek u == seek s`.
- Vex-derived laws:
  - `traverse(p).at(k) == p(seek(k, w))`
  - `peers(p) == traverse(p)` without the start key
  - `other . other == id` on pairs
  - `extract(seek(badKey, w))` is `#REF!`, not the old focus
- The current implementation would fail several of these. Per `docs/ARCHITECTURE.md` §3.5 and `BUGS.md` V-004, V-005 and V-010: focus is shared mutable state, `traverse()` leaves the focus on the last key, and unknown keys silently keep the old focus.

### 1.2 Spreadsheets as the programming model
- Excel's R1C1 notation: `R[-2]C` is "A relative reference to the cell two rows up and in the same column" and `R2C2` is "An absolute reference". On copy, relative references "automatically adjust" while absolute ones don't ([Microsoft: Overview of formulas](https://support.microsoft.com/en-us/office/overview-of-formulas-in-excel-ecfdc708-9162-49e8-b993-c311f47ca173)). Sestoft's *Spreadsheet Implementation Technology* (MIT Press 2014, DOI 10.7551/mitpress/8647.001.0001) compares A1 and R1C1. Its JFP review says that choosing R1C1 means "less modification is needed on copying" ([JFP review](https://www.cambridge.org/core/journals/journal-of-functional-programming/article/review-of-spreadsheet-implementation-technology-basics-and-extensions-by-peter-sestoft-mit-press-2014-isbn-9780262526647/B1F6E62B5E20014B4BBC9BF5135DD0BF)).
- `loeb :: Functor f => f (f a -> a) -> f a` evaluates a sheet in which each cell is a function of the whole sheet ([Piponi](http://blog.sigfpe.com/2006/11/from-l-theorem-to-spreadsheet.html)). `loeb` gives *absolute* references; the comonadic fixed point gives *relative* ones ([Chris Done](https://chrisdone.com/posts/twitter-problem-loeb/)). Foner's comonadic fixed point allows "each part of a structure to refer to its own context within the whole", and he builds an embedded DSL for "spreadsheet-like" recurrences (Haskell'15, DOI 10.1145/2804302.2804310; [abstract](https://www.cs.cornell.edu/projects/tpls/papers/20160429.shtml)).
- Excel LAMBDA made Excel "Turing-complete" ([MSR blog](https://www.microsoft.com/en-us/research/blog/lambda-the-ultimatae-excel-worksheet-function/); background: Peyton Jones, Blackwell and Burnett, ICFP'03, DOI 10.1145/944705.944721). `BYROW` "Applies a LAMBDA to each row and returns an array of the results" ([Microsoft](https://support.microsoft.com/en-us/office/byrow-function-2e04c677-78c8-4e6b-8c10-a4602f2602bb)). This is `traverse` in spreadsheet clothing.
- "Build Systems à la Carte" (ICFP'18, DOI 10.1145/3236774; [MSR page](https://www.microsoft.com/en-us/research/publication/build-systems-la-carte/)) models Excel as a build system. With applicative tasks, "the dependencies between cells can be determined statically". Monadic tasks have dynamic dependencies. Excel is modelled as a monadic system with a "calc chain" ([Hackage `build`](https://hackage.haskell.org/package/build/docs/Build-System.html)). **[partly secondary: abstract, docs and blog only]**

### 1.3 Axes, selections, array rank, windows
- XPath: "the `self` axis contains just the context node itself", and there are `following-sibling` and `preceding-sibling` axes. The context is the node plus its position and size ([XPath 1.0](https://www.w3.org/TR/1999/REC-xpath-19991116/)). In XPath 3.1 the context item, position and size "are called the focus", and in `E1/E2`, "E2 is evaluated once for each item" of E1 ([XPath 3.1](https://www.w3.org/TR/xpath-31/)). That is extend again.
- jQuery: `.siblings()` returns the siblings of each matched element, and "The original element is not included among the siblings" ([api.jquery.com/siblings](https://api.jquery.com/siblings/)). That is exactly Vex's `peers`. `.end()` pops an internal selection stack ([api.jquery.com/end](https://api.jquery.com/end/)).
- d3: a function passed to a selection method "is evaluated for each selected element, in order, being passed the current datum (d), the current index (i), and the current group (nodes)". `selectAll` groups results by parent ([d3-selection](https://d3js.org/d3-selection/selecting)). This is per-focus evaluation with access to the whole group.
- J rank: in `(u " k y)`, "the monadic verb u is applied separately to each k-cell of y", and frames must agree ([Learning J ch. 7](https://www.jsoftware.com/help/learning/07.htm)). For a matrix scope, rank 1 means per row or per column.
- SQL windows: `EXCLUDE CURRENT ROW` "excludes the current row from the frame". Note that in SQL a *peer* is a row the `ORDER BY` treats as equivalent, i.e. a tie ([PostgreSQL 4.2.8](https://www.postgresql.org/docs/current/sql-expressions.html)). Vega-Lite's window transform computes "over sorted groups", takes a `frame` such as `[-5, 5]`, and has an `ignorePeers` option ([Vega-Lite window](https://vega.github.io/vega-lite/docs/window.html)).
- **Naming warning:** Vex's "peers" (all other keys) means "siblings" in jQuery and "frame EXCLUDE CURRENT ROW" in SQL. In SQL and Vega, "peers" means ties. Consider `siblings()` or `others()`, or document the difference.

### 1.4 Optics
- Profunctor optics are modular, composable data accessors (Pickering, Gibbons and Wu, *Programming* 1(2):7, 2017; [journal](https://programming-journal.org/2017/1/7/), [arXiv:1703.10857](https://arxiv.org/abs/1703.10857)). The enriched and mixed generalization, including traversals, is in Clarke et al. ([arXiv:2001.07488](https://arxiv.org/abs/2001.07488)).
- An "Optional" is an affine traversal: "Unlike the `Lens`, the element that the `Optional` focuses on may not exist". Its laws are getOptionSet and setGetOption ([Monocle](https://www.optics.dev/Monocle/docs/optics/optional)).
- Effect v4's `Optic` module provides Iso, Lens, Prism, Optional and Traversal; Lens composed with Prism is Optional ([effect.website](https://effect.website/docs/v4/api/effect/Optic)).
- `@fp-ts/optic` types an Optional's get as `S => Either<Error, A>`, so it carries a *reason* ([README](https://github.com/fp-ts/optic)).
- partial.lenses: "`undefined` is the equivalent of non-existent", and "partial lenses are not (total) lenses" ([README](https://github.com/calmm-js/partial.lenses)).

### 1.5 Reader and Env for named locals
- Reader: "Computations which read values from a shared environment", and `local` "Executes a computation in a modified environment" ([mtl](https://hackage-content.haskell.org/package/mtl/docs/Control-Monad-Reader.html)). Its dual, the Env comonad, comes with `EnvT e w` and `local` ([comonad Env](https://hackage-content.haskell.org/package/comonad/docs/Control-Comonad-Env.html)). Per that page, "A co-Kleisli arrow in the Env comonad is isomorphic to a Kleisli arrow in the reader monad".
- Vex's evaluation context is therefore `EnvT Locals (Store K Obj)`:
  - `applyUsing(op, names)` reads named values from the environment (`asks`).
  - `localSet*` scoped to a sub-program is `local`.
  - The build-time `_local` map that evaluation ignores (V-006) has no place in this model.

### 1.6 Initial versus final encodings and the expression problem
- Wadler's statement of the problem: add new cases and new functions "without recompiling existing code, and while retaining static type safety" ([Wadler](https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt)).
- Tagless-final embeds the DSL as an overloaded interface with interpreters as instances. "Type-tag mismatch errors are patently absent because there are simply no type tags". It supports program transformations and is in bijection with the initial encoding ([Kiselyov](https://okmij.org/ftp/tagless-final/index.html); JFP 2009, DOI 10.1017/S0956796809007205).
- Object algebras solve the expression problem "in OO languages with simple generics (including Java or C#)" with no advanced typing ([Oliveira and Cook, ECOOP'12](https://www.cs.utexas.edu/~wcook/Drafts/2012/ecoop2012.pdf)). This is the most TypeScript-friendly version.
- Gibbons and Wu show that deep and shallow embeddings are "intimately connected to folds". The "banana split law" means tupling folds gives "multiple interpretations" in one pass, and they also cover dependent and context-sensitive interpretations ([Gibbons and Wu, ICFP'14](https://www.cs.ox.ac.uk/jeremy.gibbons/publications/embedding.pdf)). Open sums are covered by Swierstra, "Data types à la carte" (JFP 2008, DOI 10.1017/S0956796808006758).

**What this means for Vex.** Rebuild the core around an *immutable* focused space. Express every axis through the operations below, and make every law above a test.

```ts
interface Space<K extends string, O> {          // representable container
  readonly keys: readonly K[];
  index(k: K): Result<O>;                        // #REF! for k not in keys
  tabulate<B>(f: (k: K) => B): Space<K, B>;     // memoized extend
}
interface Focused<K extends string, O> { readonly space: Space<K, O>; readonly pos: K }
type Program<K extends string, O, T> = (w: Focused<K, O>) => Result<T>;   // coKleisli arrow
// seek, peek, extend, experiment as in store-laws.ts; derived axes:
//   self=seek, other=seeks(swap), traverse=extend, peers=experiment(k=>keys\{k}),
//   fork=product, prev/next/neighbors = relative (R1C1) seeks with a boundary policy
```

Make `traverse()` return a `Space<K, Result<T>>` that you can keep chaining on. That is coKleisli composition. It enables "compute positions, then compute offsets relative to the computed positions", and later a `sheet()` evaluator (loeb or kfix style, memoized, with #CYCLE! detection). Store references in the IR in R1C1 style (relative versus absolute), so one program is position-independent and runs at every focus.

**Top ideas in this area (ranked)**
1. Immutable Store or focused-space core, with comonad and Store law tests (fixes V-001, V-004, V-005 and V-010).
2. `traverse` returns a chainable keyed space; multi-pass via `=>=`; later `sheet()` with cycle detection.
3. R1C1-style IR references (absolute `at(k)` versus relative `rel(offset)`), plus explicit boundary policies for array and matrix scopes (V-019).
4. Optics return `Result` (with a reason), sharing the Store mathematics with the scope layer.
5. Locals become an Env layer over the Store; delete the build-time locals world.

---

## 2. TypeScript prior art for typed fluent DSLs and programs-as-data

**Key findings**
- **Kysely (type-state builder).**
  - The builder is declared `interface SelectQueryBuilder<DB, TB extends keyof DB, O>`. `select<SE extends SelectExpression<DB, TB>>(...) : SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>` accumulates the output type, and joins change `TB` ([kysely 0.29.3 d.ts](https://cdn.jsdelivr.net/npm/kysely@0.29.3/dist/query-builder/select-query-builder.d.ts)).
  - It has escape hatches for type-check cost. `$assertType` exists because "This complexity is sometimes too much"; it targets "error TS2589: Type instantiation is excessively deep and possibly infinite", and its docs say "Using this method doesn't reduce type safety at all".
  - It produces readable type errors through `KyselyTypeError<...>` template-literal messages.
- **tRPC (typed recursive Proxy).**
  - At runtime, `createRecursiveProxy` wraps a no-op function. The `get` trap extends the path, the `apply` trap calls back with `{path, args}`, proxies are memoized by path, and there are guards for `then`, `valueOf`, `toString` and `toJSON` ([source](https://raw.githubusercontent.com/trpc/trpc/main/packages/server/src/unstable-core-do-not-import/createProxy.ts)).
  - The types come from a mapped `DecorateRouterRecord` over router keys, cast with `as`. The authors admit "we actually LIE to you" about the runtime shape ([tRPC blog](https://trpc.io/blog/tinyrpc-client)).
- **Zod 4.**
  - Redesigning the generics cut a sample from more than 25,000 type instantiations to about 175, and a long `.extend()` chain from about 4,000 ms to about 400 ms.
  - "Zod's method-heavy API is fundamentally difficult to tree-shake", so Zod Mini uses standalone functions ([zod.dev/v4](https://zod.dev/v4)).
- **ts-pattern.** It tracks "handled and unhandled cases" through the builder type. `.exhaustive()` fails to type-check with `NonExhaustiveError<...>`, which costs "slightly longer compilation times" ([README](https://raw.githubusercontent.com/gvergnaud/ts-pattern/main/README.md)).
- **Effect.**
  - `Effect.gen` with `yield*` stops "at the first error" ([docs](https://effect.website/docs/getting-started/using-generators/)).
  - Schema "can be interpreted by various 'compilers'": decode and encode, arbitraries, JSON Schema, equivalence, pretty-printing ([Schema intro](https://effect.website/docs/schema/introduction/)).
  - Higher-kinded types use `TypeLambda` with `this["Target"]` ([HKT.ts](https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/HKT.ts)).
- **optics-ts** advertises "No `any`, ever", has a method-chaining syntax and a tree-shakable standalone syntax ([README](https://raw.githubusercontent.com/akheron/optics-ts/main/README.md)), and since 2.0 supports dotted paths typed via `DottedPath` ([2.4.1 README/CHANGELOG](https://cdn.jsdelivr.net/npm/optics-ts@2.4.1/README.md)).
- **ArkType** is a "1:1 validator" whose string definitions are parsed by a static (type-level) parser and a dynamic one kept in sync ([talk](https://gitnation.com/contents/arktype-bringing-typescript-to-runtime) **[secondary]**). Its test tool `@ark/attest` asserts on "types, values, errors, completions", and its benches "deterministically report the number of type instantiations" ([attest README](https://raw.githubusercontent.com/arktypeio/arktype/main/ark/attest/README.md)).
- **Remeda** offers both "Data First" and "Data Last" forms, and lazy evaluation in pipes ([docs](https://remedajs.com/docs)).
- **Hotscript** provides type-level higher-order functions (`interface X extends Fn { return: ... this["arg0"] }`). It is a work in progress with breaking changes ([README](https://raw.githubusercontent.com/gvergnaud/hotscript/main/README.md)).
- **Schema-as-value inference:** Drizzle's `typeof users.$inferSelect` ([docs](https://orm.drizzle.team/docs/goodies)) and TypeBox's `Static<typeof T>` ([README](https://raw.githubusercontent.com/sinclairzx81/typebox/main/readme.md)). Immer's draft is "a proxy of the currentState" that records mutations ([docs](https://immerjs.github.io/immer/)). I did not review Valtio or monocle-ts in depth.
- **TypeScript compile-time performance.**
  - The [Performance wiki](https://github.com/microsoft/TypeScript/wiki/Performance) recommends interfaces and `extends` over intersections, explicit return types, and avoiding unions of more than "a dozen elements". Measure with `--extendedDiagnostics` and `--generateTrace`.
  - TS 4.5 added tail-recursion elimination on conditional types; the new heuristics are "much more generous" ([TS 4.5 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html)).
  - **TypeScript 7 (the Go port) shipped GA on July 8, 2026.** Builds are typically 8 to 12 times faster. `stableTypeOrdering` is always on. There is **no programmatic API until 7.1**. `strict` and `noUncheckedSideEffectImports` are on by default ([TS 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)). The announcement does not mention any change to instantiation limits, so I assume TS2589 is still a design constraint.

**What this means for Vex.** The pattern is: a runtime Proxy that only records the op name, plus a mapped type over *declared* ops, plus a type-state chain. Here is the verified core (excerpt from `typed-chain.ts`):

```ts
type PropsOfType<O, T> = { [P in keyof O]-?: O[P] extends T ? P : never }[keyof O] & string;
type Arg<T, O, K extends string, Dm, Lift extends boolean> =
  | T | PropsOfType<O, T>                    // literal | relative ref (prop of focus)
  | readonly [K, PropsOfType<O, T>]          // absolute ref [key, prop]
  | Expr<T>                                  // nested sub-expression
  | (Lift extends true ? (T extends DomainT<Dm> ? number : never) : never); // scalar lift only if declared
type OpsProxy<Dm extends AnyDomain, O extends Obj, K extends string> = {
  [M in OpNames<Dm>]: (...args: MapArgs<OpParams<Dm, M>, O, K, Dm, Lifts<Dm, M>>) => NextChain<Dm, O, K, OpReturn<Dm, M>>;
};
type NextChain<Dm, O, K, R> = [R] extends [DomainT<Dm>] ? DomainChain<Dm, O, K> : ValueChain<Dm, O, K, R>;
interface DomainChain<...> extends ChainBase<..., DomainT<Dm>> { readonly _: OpsProxy<Dm, O, K> }
interface ValueChain<...>  extends ChainBase<..., R> {}   // no `._` after length() etc.
```

Verified behaviour under TypeScript 5.9.3 strict:
- These compile with the expected types: `c.prop("position")._.add("size").other()._.subtract("position").run("A")` gives `Result<Vector>`; `._.add(5)` works because scalar lifting is declared; `._.add(["B","size"])` works; `._.length()` gives `Result<number>`.
- These are rejected:
  - `._.nope()`
  - `._.add("name")` (a string-typed prop)
  - scalar lifting on an op without `liftScalar`
  - `["C","size"]` (unknown key)
  - `._` after `length()`
  - `.prop("weight")` (a prop that does not hold a domain value)
  - `.run("Z")`
  - any `Result<string>` or `Result<Vector>` mix-ups (so no `any` leaks through)
- The whole file costs about 6.6k instantiations including the standard library, with about 0.4 s of check time.

**Guardrails**
- Use named interfaces, not intersections, for chain states.
- Do not accumulate a typed environment record across long chains; that is Kysely's `O & ...` pattern and is what triggers TS2589. Handle locals lexically instead (§1.5, §6).
- Provide a `$assertType`-style escape hatch.
- Gate CI on attest instantiation budgets and completion assertions.
- Do not depend on the compiler API (none in TS 7.0).

**Top ideas in this area (ranked)**
1. A typed `._` built from the domain registry, with a whitelist at runtime too (fixes V-008 and V-012).
2. A type-state chain: `._` exists only when the current value is a domain value.
3. A functional `pipe(prop(...), op("add","size"), ...)` surface for tree-shaking and serialization.
4. attest-based type tests: completions, and instantiation budgets per chain length.
5. Kysely-style readable type errors (`VexTypeError<"op 'x' is not declared on Vector">`).

---

## 3. Total evaluation with error provenance

**Key findings**
- **Effect `Cause`** "strictly preserves all failure-related information". In v3 it was a tree (Empty, Fail, Die, Interrupt, Sequential, Parallel), with `Cause.pretty` for display ([docs](https://effect.website/docs/data-types/cause/)). **In Effect 4 it was flattened** into "a simple wrapper around an array of" reasons (Fail, Die, Interrupt); `Cause.combine` concatenates, and "The distinction between sequential and parallel composition is no longer represented" ([migration/cause.md](https://raw.githubusercontent.com/Effect-TS/effect/main/migration/cause.md)).
- **neverthrow**: `combine` "short circuits", `combineWithAllErrors` does not; `safeTry` uses generators; an ESLint `must-use-result` rule is "essentially a porting of Rust's `must-use`" ([README](https://raw.githubusercontent.com/supermacro/neverthrow/master/README.md)). **true-myth** provides Maybe, Result and Task, and is tree-shakeable ([README](https://raw.githubusercontent.com/true-myth/true-myth/main/README.md)).
- **Rust anyhow**: `Context` is implemented for `Option<T>` as well, so a None becomes an error with context. `with_context` is "evaluated lazily only once an error does occur", and error chains print "Caused by:" lines ([docs.rs](https://docs.rs/anyhow/latest/anyhow/trait.Context.html)).
- **Applicative accumulation**: Cats uses "separate data structures for error-accumulation (`Validated`) and short-circuiting monadic behavior (`Either`)" ([Validated](https://typelevel.org/cats/datatypes/validated.html)). Effect Schema returns "only the first error" by default and every error with `errors: "all"` ([Schema parse options](https://effect.website/docs/schema/getting-started/)).
- **Elm**: show "the code exactly as you wrote it" with targeted hints ([Compiler Errors for Humans](https://elm-lang.org/news/compiler-errors-for-humans), [Compilers as Assistants](https://elm-lang.org/blog/compilers-as-assistants)). **[secondary: search excerpts only; the page did not render for me]**
- **PostgreSQL EXPLAIN ANALYZE** shows a plan tree with one line per node, then "actually executes the query" and adds actual rows, time and loops per node, plus lines such as "Rows Removed by Filter" ([docs](https://www.postgresql.org/docs/current/using-explain.html)).
- **Excel error values** are first-class values. `ERROR.TYPE` maps #NULL! to 1, #DIV/0! to 2, #VALUE! to 3, #REF! to 4, #NAME? to 5, #NUM! to 6, #N/A to 7 ([Microsoft](https://support.microsoft.com/en-us/office/error-type-function-10958677-7c8d-44f7-ae77-b9a9ee6eefaa)). `IFERROR` traps them ([Microsoft](https://support.microsoft.com/en-us/office/iferror-function-c526fd07-caeb-47b8-8bb6-63f3e417f611)), and `BYROW` emits #VALUE! or #CALC! for bad lambdas (link in §1.2). OpenFormula's default is that errors propagate, with the leftmost error winning ([OASIS list, quoting a draft](https://lists.oasis-open.org/archives/office/200912/msg00140.html); [ODF 1.2 Part 2](https://docs.oasis-open.org/office/v1.2/OpenDocument-v1.2-part2.html)). **[secondary on the final wording]**
- **Why-not provenance**: Chapman and Jagadish's "Why Not?" (SIGMOD'09, DOI 10.1145/1559845.1559901) belongs to the query-based approaches, which pinpoint the operator at which an expected answer is lost ([Duke lecture](https://www.cs.duke.edu/courses/fall15/compsci590.6/Lectures/Lecture-10.pdf)) **[secondary]**. Provenance semirings: Green, Karvounarakis and Tannen, PODS'07, DOI 10.1145/1265530.1265535.
- **One-way constraint toolkits**: a decade of Garnet and Amulet experience found that locating faults in constraints stays hard, and the authors call for better debugging tools ([TOPLAS 2001 tech report](https://library.eecs.utk.edu/files/ut-cs-01-472.pdf)) **[summary via search]**.

**What this means for Vex.**
- Keep `Optional` at the spec boundary (`value()` and `run()`). Internally evaluate to `Result<T, VexError>` with an error type modelled on Excel's codes:

| Code | Vex cause | Fixes |
|---|---|---|
| `#REF!` | unknown key, `other()` outside a pair, matrix out of bounds | V-004, V-005, V-019 |
| `#N/A` | property missing on the focus or peer | — |
| `#VALUE!` | `isInstance` or argument-kind failure, unvalidated domain constant | V-007 |
| `#NAME?` | op not declared by the domain | V-008 |
| `#NUM!` | non-finite result (explicit policy instead of silent drops or 0) | V-017, V-018 |
| `#CALC!` | the op threw | V-009 |
| `#CYCLE!` | cycle during `sheet()` evaluation | — |
| `#ARGS` | several argument errors, accumulated | — |

- Every error carries `{step, focus, op}`.
- Sequence steps fail-fast (monadic), but evaluate *arguments* applicatively and accumulate their errors.
- Following Effect 4, keep the error itself as a flat list of reasons. Keep a separate **trace tree** for explanation.
- API:
  - `explain(start)` returns `{ result, trace: { step, label, focus, inputs, output, ms? }[] }`.
  - `explainTraversal()` returns per-key results plus EXPLAIN-style counters, e.g. "7 of 10 keys failed at step 2 `.prop("size")` with #N/A". That is why-not provenance for the keys that came back `none`.
- Run the tracer as a no-op by default and build context lazily, as anyhow's `with_context` does.
- Ship a lint, or a `@mustUse` convention, for `Result` values.

**Top ideas in this area (ranked)**
1. `Result` internally, `Optional` at the boundary, and Excel-coded `VexError` values.
2. `explain()` and `explainTraversal()` with per-step traces and failure counters.
3. Applicative argument accumulation (`#ARGS`).
4. One consistent strictness policy: lenient versus strict reducers report counts instead of silently skipping (V-013).
5. Error-value-aware reducers in the style of IFERROR or IFNA (`orElse`, `ifNA`).

---

## 4. Algebraic metadata: optimization and verification

**Key findings**
- **Futhark**: in `reduce`, "The function `op` must be associative. If it is not, the return value is unspecified". There is a separate `reduce_comm` for commutative operators, and `hist` requires commutative and associative operators with a neutral element ([prelude](https://futhark-lang.org/docs/prelude/doc/prelude/soacs.html)).
- **Halide**: `rfactor` "splits an associative update definition into an intermediate which computes the partial results". "If rfactor can't prove the associativity of a reduction, it will throw an error", and slicing by columns also needs commutativity ([lesson 18](https://halide-lang.org/docs/tutorial/lesson_18_parallel_associative_reductions.html)). The paper is Suriana, Adams and Kamil, CGO'17.
- **Spark**: the function passed to `reduce` "should be commutative and associative so that it can be computed correctly in parallel" ([RDD guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html)).
- **Algebird and Summingbird**: abstract algebra "targeted at building aggregation systems" ([README](https://raw.githubusercontent.com/twitter/algebird/develop/README.md)). Summingbird credits algebraic structures for merging batch and online results (VLDB'14, DOI 10.14778/2733004.2733016) **[abstract paraphrase]**. Laws are checked in `BaseProperties` (`isAssociative`, `isCommutative`, `semigroupLaws`, `monoidLaws`, ...) ([source](https://github.com/twitter/algebird/blob/develop/algebird-test/src/main/scala/com/twitter/algebird/BaseProperties.scala)).
- **Differential dataflow** tracks "any map from the records to an Abelian group" through its `Semigroup`, `Monoid` and `Abelian` traits ([docs.rs](https://docs.rs/differential-dataflow/latest/differential_dataflow/difference/index.html)).
- **CRDTs** converge when merge is associative, commutative and idempotent (a join-semilattice) ([Shapiro, Encyclopedia of DB Systems](https://perso.lip6.fr/Marc.Shapiro/papers/replicated-data-types-Encyclopedia-DB-systems-2016-authorversion.pdf); SSS'11 [HAL](https://hal.sorbonne-universite.fr/inria-00609399v1)) **[secondary]**. Related lattice-based languages: Flix (PLDI'16, DOI 10.1145/2908080.2908096), Datafun (ICFP'16, DOI 10.1145/2951913.2951948), and Hellerstein and Alvaro's "Keeping CALM" (CACM 2020, DOI 10.1145/3369736).
- **Steele**, "Organizing Functional Code for Parallel Execution; or, foldl and foldr Considered Slightly Harmful" (ICFP'09, DOI 10.1145/1596550.1596551): user-defined associative combiners enable divide-and-conquer parallelism **[secondary accounts]**.
- **Rewriting with laws**: equality saturation "repurposes e-graphs to implement state-of-the-art, rewrite-driven compiler optimizations" ([egg, POPL'21](https://arxiv.org/abs/2004.03082)).
- **Checking laws in practice**: Cats `checkAll("Tree.FunctorLaws", FunctorTests[Tree].functor[...])`, which needs Arbitrary and Eq instances ([Cats law testing](https://typelevel.org/cats/typeclasses/lawtesting.html)); `fp-ts-laws` does the same on top of fast-check ([README](https://raw.githubusercontent.com/gcanti/fp-ts-laws/master/README.md)). fast-check's model-based testing uses `fc.commands`, `Command.check/run/toString` and `modelRun`. "The model should not be a carbon copy of the system", and failing command sequences are shrunk and can be replayed ([fast-check docs](https://fast-check.dev/docs/advanced/model-based-testing/)).

**What this means for Vex.** Declare laws next to the op and verify them:

```ts
ops: {
  add: { laws: ["commutative", "associative"], identity: () => Vector.zero, liftScalar: true },
  max: { laws: ["commutative", "associative", "idempotent"] },
}
checkDomainLaws(VectorDomain, { arb: vectorArb, eq: approxEq(1e-9) }); // emits one fast-check property per declared law
```

- Use approximate equality for floats; IEEE addition is not associative, which is general knowledge.
- A law suite would have caught **V-016** (`Color.add` is declared commutative but keeps `this.a`) on its first run.
- Once declared laws are verified, the optimizer and traversals can rely on them:
  - associative: tree-reduce in traversals, and fold constants (`x.add(c1).add(c2)` becomes `x.add(c1.add(c2))`);
  - commutative: put arguments in a canonical order for memo keys and treat record key order as irrelevant;
  - identity: an empty traversal returns the identity instead of `none`;
  - idempotent: deduplicate repeated peers;
  - pure: common-subexpression elimination and memoization through the representable store.
- Add model-based testing of the evaluator itself. Random chains become `fc.commands`, checked against a tiny reference interpreter.

**Top ideas in this area (ranked)**
1. `checkDomainLaws` built on fast-check, discipline-style.
2. Model-based tests of chain evaluation against a reference model.
3. Law-gated optimizations (reassociation, canonicalization, tree-reduce, memoization).
4. An identity and empty-traversal semantics.
5. Long term: rewrite rules or an e-graph pass over the IR.

---

## 5. Adapter and typeclass registries without prototype mutation

**Key findings**
- **fp-ts** registers types by module augmentation of `interface URItoKind<A>`, and instances are plain dictionaries (`export const Functor: Functor1<URI> = { URI, map }`) ([HKT guide](https://gcanti.github.io/fp-ts/guides/HKT.html)). **Effect** uses `TypeLambda` with `Kind<F, In, Out2, Out1, Target>` (link in §2).
- **Static Land versus Fantasy Land.** Fantasy Land puts `fantasy-land/map`-style methods on the values themselves ([spec](https://raw.githubusercontent.com/fantasyland/fantasy-land/master/README.md)). Static Land instead uses "static functions, that are grouped together in modules". Its listed benefits: no name clashes, many modules for one type (Addition versus Multiplication), and support for built-in types ([static-land](https://raw.githubusercontent.com/fantasyland/static-land/master/README.md)).
- **Symbol-keyed protocols on types you own**: Effect's `[Equal.symbol]` and `[Hash.symbol]` methods ([docs](https://effect.website/docs/trait/equal/)). A shared protocol by property: Standard Schema's `"~standard"` property with `version`, `vendor`, `validate` and `types` ([standardschema.dev](https://standardschema.dev/)).
- **Toolchain facts.**
  - By default TypeScript "detects that you're only using an import for types and drops the import entirely". Under `verbatimModuleSyntax`, "any imports or exports without a `type` modifier are left around" ([tsconfig reference](https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax)).
  - Side-effect imports are unchecked unless `noUncheckedSideEffectImports` is on; it is on by default in TS 7.
  - webpack defines a side effect as "code that performs a special behavior when imported, other than exposing one or more exports"; such modules must be listed in `sideEffects`. `/*#__PURE__*/` marks calls that are safe to drop ([webpack tree-shaking](https://webpack.js.org/guides/tree-shaking/)).
  - `const` type parameters (TS 5.0) and `NoInfer` (TS 5.4) help keep op specs literal ([5.0](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/), [5.4](https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/)).

**What this means for Vex.**
- Use `defineDomain<const Name, D, const Ops>({ name, is, fromScalar?, ops: { add: { laws, liftScalar, identity? } } })`. This is the verified prototype in §2: op parameter and return types are read from the class's own method signatures (`D[M]`). The domain *value* owns its registry, so:
  - there is no prototype mutation;
  - two adapters for one class cannot contaminate each other (V-002);
  - nothing breaks under import elision (V-003);
  - only declared ops are callable (V-008);
  - `methodReturns` becomes the inferred type, so that dead API disappears (V-024).
- Export domains as plain values, mark `sideEffects: false`, and wrap `defineDomain(...)` in `/*#__PURE__*/`. Recommend `verbatimModuleSyntax`.
- For classes you own, optionally expose `static [VEX_DOMAIN] = VectorDomain` for discovery. Always allow explicit dictionaries for foreign classes.
- If name-based lookup is wanted, use a declaration-merged `interface VexDomains { Vector: typeof VectorDomain }` in the style of URItoKind. That is a type-only registry with no runtime cost.

**Top ideas in this area (ranked)**
1. Domain-owned dictionary registry (static-land style).
2. No registration by import; tree-shakable domains.
3. Op types inferred from method signatures plus declared metadata.
4. An optional Symbol protocol for classes you own.
5. A type-only, declaration-merged name registry.

---

## 6. Positioning Vex as a "builder language framework"

**Key findings**
- **F# computation expressions.** "Every computation expression is backed by a *builder* type", and syntax is desugared into builder methods (`Bind`, `Return`, `For`, `MergeSources` for applicative `and!`, `Run`, `Quote`). A builder can add `[<CustomOperation>]` keywords, which is how query expressions work ([Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/computation-expressions)).
- **Kotlin type-safe builders** use lambdas with receivers. `@DslMarker` restricts calls to "members of the nearest receivers only" ([Kotlin docs](https://kotlinlang.org/docs/type-safe-builders.html)).
- **Racket** offers a spectrum from macros through module languages to readers to `#lang` ([Racket Guide](https://docs.racket-lang.org/guide/languages.html); "A Programmable Programming Language", CACM 61(3), 2018, DOI 10.1145/3127323 **[bibliographic only]**).
- **Fowler's DSL catalog**: "Semantic Model" is "The model that's populated by a DSL". "Expression Builder" is a fluent interface over a command-query API. "Notification" "Collects errors and other messages to report back to the caller" ([catalog](https://martinfowler.com/dslCatalog/)). Vex's IR is a Semantic Model, and the chain is an Expression Builder.
- **LMS (Rompf and Odersky, GPCE'10, DOI 10.1145/1942788.1868314)**: types mark the stages of computation, and the optimizing compiler framework is extensible with domain-specific optimizations ([EPFL PDF](https://infoscience.epfl.ch/record/149131/files/paper.pdf?version=1)) **[paraphrase]**.
- **External-DSL tools** (a different niche): Langium is a TypeScript language-engineering tool with LSP support ([docs](https://langium.org/docs/introduction/)); Ohm "completely separates grammars from semantic actions" ([README](https://raw.githubusercontent.com/ohmjs/ohm/main/README.md)).
- **Fluent-API generators** are the closest academic match to "builder language framework":
  - Fling compiles a deterministic context-free language (LR(k)) into a fluent API for Java (ECOOP'19, DOI 10.4230/LIPIcs.ECOOP.2019.13; [Dagstuhl](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2019.13)).
  - TypeLevelLR generates fluent APIs with syntax checking for Scala, Haskell and C++ from an LR grammar, using overloading (OOPSLA'19, DOI 10.1145/3360560).
  - Silverchain (GPCE'17, DOI 10.1145/3136040.3136041).
  - Theory of what type checkers can recognize: [arXiv:2009.04437](https://arxiv.org/abs/2009.04437).
- **"One description, many compilers"**: Effect Schema (§2).

**What this means for Vex: closest neighbours and the unique niche**

| Closest thing | What it shares with Vex | What it lacks |
|---|---|---|
| Excel R1C1, LAMBDA, BYROW | relative and absolute refs, per-row programs, error values | typing, embedding, user domains |
| SQL windows, Vega-Lite window | per-row computations over neighbours (frames, excluding self) | arbitrary domain objects and methods |
| Ypnos, Foner | comonadic per-focus DSLs | TypeScript, user adapters, explanation |
| Effect Schema | many interpreters from one description | relative computation over collections |
| Kysely, ts-pattern | type-state fluent typing | domain-agnostic adapters |
| Fling, TypeLevelLR | a typed chain generated from a spec | they generate from grammars, not from domain adapters |

**Proposed framework layers**
1. **Domains**: `defineDomain`, with laws.
2. **Spaces**: representable containers (record, array, matrix, later tree) plus axes (self, other, siblings, all, prev, next, neighbors, byRow, byCol).
3. **Program IR**: an open discriminated union, extended through declaration merging plus an object-algebra handler record.
4. **Interpreters as folds**: eval, explain, deps, serialize (R1C1 JSON), pretty, optimize. Eval and trace can be tupled into one pass (the banana-split result).
5. **Surfaces**: the typed proxy chain, `pipe` functions, and generator or HOAS sugar.

For locals, prefer HOAS-style lexical binding over the localSet/applyUsing machinery, as in Kysely's callback builders, e.g. `let_({ rhs: ref("B","position") }, ({ rhs }) => cur._.subtract(rhs))`. Here `rhs` is a typed `Expr<Vector>`, so dependencies stay static and TypeScript infers the local types without accumulating an environment type.

**Top ideas in this area (ranked)**
1. Position Vex as "typed spreadsheet formulas over domain objects".
2. The five-layer framework, with domains and spaces as the user's extension points.
3. Interpreters as folds over one open IR.
4. HOAS or lexical locals.
5. A serializable, position-independent IR, so programs can be shipped to workers, cached and diffed.

---

## 7. Layout and relative computations (the "Biblo" hint)

**Key findings**
- **Garnet and Amulet one-way, dataflow constraints**: about a decade of lessons, including that debugging constraints is hard (TOPLAS 23(6), 2001, DOI 10.1145/506315.506318; [tech report](https://library.eecs.utk.edu/files/ut-cs-01-472.pdf)).
- **Cassowary**: incremental linear-arithmetic constraint solving for user interfaces (TOCHI 8(4), 2001, DOI 10.1145/504704.504705; [UW report](https://constraints.cs.washington.edu/solvers/cassowary-tr.html)). kiwi.js is "a fast TypeScript implementation of the Cassowary constraint solving algorithm" and is now unmaintained in favour of lume/kiwi ([README](https://raw.githubusercontent.com/IjzerenHein/kiwi.js/master/README.md)).
- **WebCola**: separation constraints such as `{"axis":"y","left":0,"right":1,"gap":25}` mean `nodes[0].y + gap <= nodes[1].y` ([WebCola](https://ialab.it.monash.edu/webcola/)). That is Vex's "position = other.position + size", but as an inequality to solve rather than a formula.
- **Bluefish** composes diagrams from declarative *relations* (Align, Distribute, Stack, ...) over a compound graph (UIST'24, DOI 10.1145/3654777.3676465; [arXiv:2307.00146](https://arxiv.org/abs/2307.00146)).
- **Meyerovich and Bodík** cast CSS layout as an attribute grammar to parallelize it (WWW'10, DOI 10.1145/1772690.1772763; [PDF](https://archives.iw3c2.org/www2010/_lmeyerov/projects/pbrowser/pubfiles/playout.pdf)). This is the same zipper-comonad and attribute-grammar line as Uustalu and Vene (§1.1).
- **Bevy**: `GlobalTransform` "is computed by successively applying the Transform of each ancestor entity", in a propagation system set ([docs.rs](https://docs.rs/bevy/latest/bevy/transform/components/struct.GlobalTransform.html)). Parent-relative, hierarchical computation is a tree-focused comonad (a tree zipper).

**What this means for Vex.** Vex is a one-way formula layer, not a solver. Keep it that way, and add:
- multi-pass evaluation through `extend` composition;
- a **tree space** with parent, children, ancestors and descendants axes (XPath-style), which directed containers show is also comonadic;
- static dependency extraction from references kept as data, so that moving one node recomputes only its dependents (the spreadsheet calc-chain idea);
- `#CYCLE!` detection;
- optionally, compiling a linear subset (ops declared `linear`) into kiwi or Cassowary constraints, for relations that need solving (inequalities, cycles).

**Top ideas in this area (ranked)**
1. Incremental recompute from static references.
2. Tree space and axes.
3. Multi-pass `extend` composition.
4. A solver hand-off for linear constraints.
5. A relations library (align, distribute, stack) built as Vex programs.

---

## Top 15 ideas for Vex

1. **An immutable Store or focused-space core.** Express self, other, traverse, peers and fork through `seek`, `peek`, `extend` and `experiment`. Fixes V-001, V-004, V-005, V-010 and traverse leaving the focus on the last key.
2. **Comonad and Store laws as property tests.** The ready-made suite is in `store-laws.ts`; port it to fast-check.
3. **`traverse` returns a chainable keyed Space** (coKleisli composition). Later add `sheet()` with memoization and `#CYCLE!`.
4. **`defineDomain` with a domain-owned op registry**: a whitelist, laws, `liftScalar`, identity; no prototype mutation; tree-shakable. Fixes V-002, V-003, V-008 and V-024.
5. **A typed `._` proxy plus a type-state chain**, already verified under TypeScript 5.9 strict. Fixes V-012 and V-014.
6. **`Result<T, VexError>` internally with Excel-style codes; `Optional` only at the boundary.** Fixes V-007, V-009, V-013 and V-022.
7. **`explain()` and `explainTraversal()`** in the EXPLAIN ANALYZE style, with per-step traces, failure counters and lazy context.
8. **Applicative argument evaluation that accumulates all argument errors.**
9. **`checkDomainLaws`** (discipline, Algebird or fp-ts-laws style, on fast-check) with float tolerance. It catches V-016 today.
10. **Model-based testing of the evaluator**: random chains via `fc.commands`, checked against a tiny reference model.
11. **An open initial IR** (declaration-merged union plus handler record) with interpreters as folds: eval, explain, deps, JSON, pretty. Fixes V-020 and V-021.
12. **Static dependency extraction** for incremental recompute, aimed at layout. Keep references as data; use generator syntax only as sugar.
13. **Lexical or HOAS named locals on an Env layer over the Store.** Delete the `_local` world. Fixes V-006 and V-023.
14. **An axis vocabulary taken from XPath, jQuery, J and SQL** (siblings, prev, next, neighbors, byRow, byCol), and resolve the clash with SQL's meaning of "peers".
15. **Law-gated optimizations and solver interoperability**: reassociation, canonical argument order, tree-reduce, memoization of pure ops; later an e-graph pass and Cassowary hand-off for layout.

---

## Verified versus unverified
- **Verified by running code:** the typed-chain prototype and the Store law checks (both in the scratchpad).
- **Secondary or partial:** Elm's error-message principles; the final OpenFormula wording on error propagation; Steele's exact wording; the why-not provenance algorithm details; the CRDT 2011 formal conditions; the content of Summingbird and LMS (abstract paraphrases); ArkType's speed claims (vendor numbers that vary by source); the CACM Racket article (bibliographic only); Uustalu and Vene's attribute-evaluation paper (catalog and mailing list only); Build Systems à la Carte (abstract, docs and blog).
- **Not reviewed:** Valtio and monocle-ts in depth. I also could not confirm whether Effect 4 renamed Either to Result, so the report does not claim it.

---

## Bibliography (grouped)

**Comonads, zippers, Store**
- [comonad: Control.Comonad](https://hackage-content.haskell.org/package/comonad-5.0.10/docs/Control-Comonad.html)
- [comonad: ComonadStore](https://hackage-content.haskell.org/package/comonad-5.0.10/docs/Control-Comonad-Store-Class.html)
- [comonad: Env](https://hackage-content.haskell.org/package/comonad/docs/Control-Comonad-Env.html)
- [adjunctions: Representable Store](https://hackage-content-origin.haskell.org/package/adjunctions-4.4.3/docs/Control-Comonad-Representable-Store.html)
- [adjunctions: Data.Functor.Rep](https://hackage-content.haskell.org/package/adjunctions-4.4.4/docs/Data-Functor-Rep.html)
- [Ahman, Chapman, Uustalu, LMCS 2014](https://lmcs.episciences.org/894/pdf)
- [Huet, The Zipper (PDF)](http://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf)
- [Panchekha on zippers](https://pavpanchekha.com/blog/zippers/huet.html)
- [Piponi: cellular automata are comonadic](http://blog.sigfpe.com/2006/12/evaluating-cellular-automata-is.html)
- [Capobianco and Uustalu, arXiv:1012.1220](https://arxiv.org/abs/1012.1220)
- [Orchard et al., Ypnos](https://www.cs.kent.ac.uk/people/staff/dao7/publ/ypnos-damp10.pdf)
- [Foner, abstract page](https://www.cs.cornell.edu/projects/tpls/papers/20160429.shtml)
- [Uustalu 2005 post](https://mail.haskell.org/pipermail/haskell/2005-September/016505.html)
- [mtl Reader](https://hackage-content.haskell.org/package/mtl/docs/Control-Monad-Reader.html)
- Uustalu and Vene DOIs: 10.1016/j.entcs.2008.05.029 and 10.1007/11575467_2

**Spreadsheets, axes, windows**
- [Microsoft: Overview of formulas (R1C1)](https://support.microsoft.com/en-us/office/overview-of-formulas-in-excel-ecfdc708-9162-49e8-b993-c311f47ca173)
- [Sestoft book review, JFP](https://www.cambridge.org/core/journals/journal-of-functional-programming/article/review-of-spreadsheet-implementation-technology-basics-and-extensions-by-peter-sestoft-mit-press-2014-isbn-9780262526647/B1F6E62B5E20014B4BBC9BF5135DD0BF)
- [Piponi: loeb](http://blog.sigfpe.com/2006/11/from-l-theorem-to-spreadsheet.html)
- [Chris Done: loeb](https://chrisdone.com/posts/twitter-problem-loeb/)
- [MSR: LAMBDA](https://www.microsoft.com/en-us/research/blog/lambda-the-ultimatae-excel-worksheet-function/)
- [Microsoft: BYROW](https://support.microsoft.com/en-us/office/byrow-function-2e04c677-78c8-4e6b-8c10-a4602f2602bb)
- [Build Systems à la Carte](https://www.microsoft.com/en-us/research/publication/build-systems-la-carte/)
- [Hackage build](https://hackage.haskell.org/package/build/docs/Build-System.html)
- [XPath 1.0](https://www.w3.org/TR/1999/REC-xpath-19991116/)
- [XPath 3.1](https://www.w3.org/TR/xpath-31/)
- [jQuery .siblings()](https://api.jquery.com/siblings/)
- [jQuery .end()](https://api.jquery.com/end/)
- [d3-selection](https://d3js.org/d3-selection/selecting)
- [Learning J, ch. 7](https://www.jsoftware.com/help/learning/07.htm)
- [PostgreSQL window calls](https://www.postgresql.org/docs/current/sql-expressions.html)
- [Vega-Lite window](https://vega.github.io/vega-lite/docs/window.html)

**Optics**
- [Profunctor Optics (journal)](https://programming-journal.org/2017/1/7/)
- [Clarke et al., arXiv:2001.07488](https://arxiv.org/abs/2001.07488)
- [Monocle Optional](https://www.optics.dev/Monocle/docs/optics/optional)
- [Effect Optic](https://effect.website/docs/v4/api/effect/Optic)
- [@fp-ts/optic](https://github.com/fp-ts/optic)
- [partial.lenses](https://github.com/calmm-js/partial.lenses)
- [optics-ts README](https://raw.githubusercontent.com/akheron/optics-ts/main/README.md)
- [optics-ts 2.4.1 (CDN)](https://cdn.jsdelivr.net/npm/optics-ts@2.4.1/README.md)
- [nLab: lens](https://ncatlab.org/nlab/show/lens+%28in+computer+science%29)
- [Gibbons and Johnson](https://www.cs.ox.ac.uk/publications/publication4599-abstract.html)

**Embedding and the expression problem**
- [Wadler](https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt)
- [Kiselyov: tagless-final](https://okmij.org/ftp/tagless-final/index.html)
- [Oliveira and Cook](https://www.cs.utexas.edu/~wcook/Drafts/2012/ecoop2012.pdf)
- [Gibbons and Wu](https://www.cs.ox.ac.uk/jeremy.gibbons/publications/embedding.pdf)
- Swierstra, "Data types à la carte", DOI 10.1017/S0956796808006758

**TypeScript**
- [Kysely d.ts](https://cdn.jsdelivr.net/npm/kysely@0.29.3/dist/query-builder/select-query-builder.d.ts)
- [tRPC createProxy](https://raw.githubusercontent.com/trpc/trpc/main/packages/server/src/unstable-core-do-not-import/createProxy.ts)
- [tRPC blog](https://trpc.io/blog/tinyrpc-client)
- [Zod v4](https://zod.dev/v4)
- [ts-pattern](https://raw.githubusercontent.com/gvergnaud/ts-pattern/main/README.md)
- [Effect generators](https://effect.website/docs/getting-started/using-generators/)
- [Effect Schema](https://effect.website/docs/schema/introduction/)
- [Effect HKT](https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/HKT.ts)
- [ArkType talk](https://gitnation.com/contents/arktype-bringing-typescript-to-runtime)
- [attest](https://raw.githubusercontent.com/arktypeio/arktype/main/ark/attest/README.md)
- [Remeda](https://remedajs.com/docs)
- [Hotscript](https://raw.githubusercontent.com/gvergnaud/hotscript/main/README.md)
- [Drizzle](https://orm.drizzle.team/docs/goodies)
- [TypeBox](https://raw.githubusercontent.com/sinclairzx81/typebox/main/readme.md)
- [Immer](https://immerjs.github.io/immer/)
- [TS Performance wiki](https://github.com/microsoft/TypeScript/wiki/Performance)
- [TS 4.5 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html)
- [TS 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [TS 5.0](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/)
- [TS 5.4](https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/)

**Errors and provenance**
- [Effect Cause](https://effect.website/docs/data-types/cause/)
- [Effect 4 Cause migration](https://raw.githubusercontent.com/Effect-TS/effect/main/migration/cause.md)
- [neverthrow](https://raw.githubusercontent.com/supermacro/neverthrow/master/README.md)
- [true-myth](https://raw.githubusercontent.com/true-myth/true-myth/main/README.md)
- [anyhow Context](https://docs.rs/anyhow/latest/anyhow/trait.Context.html)
- [Cats Validated](https://typelevel.org/cats/datatypes/validated.html)
- [Effect Schema parse options](https://effect.website/docs/schema/getting-started/)
- [Elm: Compiler Errors for Humans](https://elm-lang.org/news/compiler-errors-for-humans)
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Microsoft: ERROR.TYPE](https://support.microsoft.com/en-us/office/error-type-function-10958677-7c8d-44f7-ae77-b9a9ee6eefaa)
- [Microsoft: IFERROR](https://support.microsoft.com/en-us/office/iferror-function-c526fd07-caeb-47b8-8bb6-63f3e417f611)
- [OASIS list message](https://lists.oasis-open.org/archives/office/200912/msg00140.html)
- [Duke why-not lecture](https://www.cs.duke.edu/courses/fall15/compsci590.6/Lectures/Lecture-10.pdf)
- Chapman and Jagadish, "Why Not?", DOI 10.1145/1559845.1559901
- Provenance semirings, DOI 10.1145/1265530.1265535

**Algebra and laws**
- [Futhark prelude](https://futhark-lang.org/docs/prelude/doc/prelude/soacs.html)
- [Halide lesson 18](https://halide-lang.org/docs/tutorial/lesson_18_parallel_associative_reductions.html)
- [Spark RDD guide](https://spark.apache.org/docs/latest/rdd-programming-guide.html)
- [Algebird](https://raw.githubusercontent.com/twitter/algebird/develop/README.md)
- [Algebird BaseProperties](https://github.com/twitter/algebird/blob/develop/algebird-test/src/main/scala/com/twitter/algebird/BaseProperties.scala)
- [differential-dataflow](https://docs.rs/differential-dataflow/latest/differential_dataflow/difference/index.html)
- [Shapiro: CRDTs](https://perso.lip6.fr/Marc.Shapiro/papers/replicated-data-types-Encyclopedia-DB-systems-2016-authorversion.pdf)
- [egg](https://arxiv.org/abs/2004.03082)
- [Cats law testing](https://typelevel.org/cats/typeclasses/lawtesting.html)
- [fp-ts-laws](https://raw.githubusercontent.com/gcanti/fp-ts-laws/master/README.md)
- [fast-check model-based testing](https://fast-check.dev/docs/advanced/model-based-testing/)
- Steele, ICFP'09, DOI 10.1145/1596550.1596551

**Registries**
- [fp-ts HKT guide](https://gcanti.github.io/fp-ts/guides/HKT.html)
- [Static Land](https://raw.githubusercontent.com/fantasyland/static-land/master/README.md)
- [Fantasy Land](https://raw.githubusercontent.com/fantasyland/fantasy-land/master/README.md)
- [Effect Equal](https://effect.website/docs/trait/equal/)
- [Standard Schema](https://standardschema.dev/)
- [tsconfig: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax)
- [webpack tree-shaking](https://webpack.js.org/guides/tree-shaking/)

**DSL frameworks**
- [F# computation expressions](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/computation-expressions)
- [Kotlin type-safe builders](https://kotlinlang.org/docs/type-safe-builders.html)
- [Racket Guide: creating languages](https://docs.racket-lang.org/guide/languages.html)
- [Fowler DSL catalog](https://martinfowler.com/dslCatalog/)
- [LMS (EPFL PDF)](https://infoscience.epfl.ch/record/149131/files/paper.pdf?version=1)
- [Langium](https://langium.org/docs/introduction/)
- [Ohm](https://raw.githubusercontent.com/ohmjs/ohm/main/README.md)
- [Fling](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2019.13)
- [Gil and Roth, arXiv:2009.04437](https://arxiv.org/abs/2009.04437)
- TypeLevelLR, DOI 10.1145/3360560
- Silverchain, DOI 10.1145/3136040.3136041

**Layout**
- [Garnet/Amulet tech report](https://library.eecs.utk.edu/files/ut-cs-01-472.pdf)
- [Cassowary report](https://constraints.cs.washington.edu/solvers/cassowary-tr.html)
- [kiwi.js](https://raw.githubusercontent.com/IjzerenHein/kiwi.js/master/README.md)
- [WebCola](https://ialab.it.monash.edu/webcola/)
- [Bluefish, arXiv:2307.00146](https://arxiv.org/abs/2307.00146)
- [Meyerovich and Bodík](https://archives.iw3c2.org/www2010/_lmeyerov/projects/pbrowser/pubfiles/playout.pdf)
- [Bevy GlobalTransform](https://docs.rs/bevy/latest/bevy/transform/components/struct.GlobalTransform.html)

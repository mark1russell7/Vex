# Vex:= Optional‑First Functional Chain DSL — **Language Specification** (v0.9)

> This document specifies a **domain‑agnostic**, **Optional‑first**, **functional** DSL for building composable data‑flow programs over structured collections of objects that expose one or more **domain values** (e.g., `Vector`).
> The DSL is realized as a set of **thin, orthogonal layers** in TypeScript. It is not a string‑parsed language; its *surface syntax* is the fluent API you call from TypeScript. This spec defines the **abstract syntax**, **static and dynamic semantics**, **type discipline**, **algebraic laws**, and **conformance requirements** for any implementation.

---

## 0. Goals & Non‑Goals

**Goals**

1. **Generalization** — The DSL works with *any* domain type `D` (Vector, Complex, Color, Angle…) via a small **DomainAdapter**; no per‑method wiring.
2. **Optional‑First** — All evaluation is total and side‑effect free from the DSL’s point of view; failures map to `Optional.none`.
3. **Functional Composition** — Chains, traversals, and reductions are expressed as pure folds over immutable **IR steps**.
4. **Unification** — One abstraction serves maps, arrays, and matrices; traversals unify **start axis** and **peer axis**; aggregation is by **Monoids**.
5. **Thin Lingual Layers** — Each concept appears *once*, with no imperative duplication: Optional, Algebra, IR, Adapter, Scope, Chain, Traversal.
6. **Ergonomics without Magic** — New domain methods “just work” (captured by Proxy); scalar lifting and algebraic facts are **declarative metadata** on prototype methods.

**Non‑Goals**

* The spec does not mandate a specific rendering/UI or editor integration.
* The spec does not fix a single strict typing regime for terminal value kinds (scalar/boolean); it defines an optional typing extension.

---

## 1. Terminology and Notation

* `Optional<T>` is a right‑biased disjoint union with constructors `some(T)` and `none<T>()`.
  All examples assume the implementation in `external/Funk/optional/optional`.
* `Monoid<M>` is a pair `(empty: M, concat: (M, M) => M)`.
  See `math/algebra/monoid.ts`.
* **Domain** `D`: the *underlying* class you operate on (e.g., `Vector`).
* **Object schema** `Obj`: user objects that *contain* one or more fields of type `D` (e.g., `{ position: Vector, size: Vector }`).
* **Start axis**: traversing *which object* acts as the current focus (A, B, C…).
* **Peer axis**: traversing *others* relative to the current start (e.g., “all except A”).

Normative terms: **MUST**, **SHOULD**, **MAY** follow RFC‑2119 usage.

---

## 2. Layered Architecture (Normative)

The DSL is composed of the following layers. Each layer **MUST** be independent and free of knowledge belonging to layers above it.

1. **Optional Layer**
   Provides `mapOpt`, `chainOpt`, `apOpt`, `sequenceArrayOpt`, `reduceWithMonoidOpt`.
   It **MUST NOT** expose or rely on `.left`/`.right` fields; all access goes through `fold`, `map`, `chain`.

2. **Algebra Layer**
   Provides `Monoid<T>` and standard instances: `all`, `any`, `sum`, `product`, `first`.
   Used by Traversal reducers.

3. **IR Layer (Abstract Syntax)**

   * **ArgRef** ∈ { `ConstD`, `ConstS`, `PropRef`, `OfRef`, `NestedExpr`, `Current` }
   * **Step** ∈ { `Select(prop)`, `Switch(to, key?)`, `Invoke(op, args: ArgRef[])` }
   * **Program** is a finite `Step[]`.

4. **Adapter Layer (Domain Binding)**

   * `DomainAdapter<D>` with `isInstance`, `getMethod`, optional `fromScalar`, optional `methodReturns`.
   * **Op metadata** (`DSL_OP_META` on prototype methods): `liftScalar` (boolean|boolean\[]), `commutative`, `associative`, `pure`.

5. **Scope Layer (Environment/Navigation)**

   * `Scope<D>` with `getPropOpt`, `getPropOfOpt`, `setFocusByKey`, `setFocusByIndex`, `setFocusToOther`, `currentKey`, `keys`.
   * Implementations: **MapScope**, **ArrayScope**, **MatrixScope**.
     All property reads return `Optional<D>`.

6. **Evaluator (Dynamic Semantics)**

   * Total function `evalProgram(adapter, steps, initial: Optional<D>, scope?): Optional<any>`.
   * Implements **switch / select / invoke** semantics over `Optional`.

7. **Chain Layer (Surface DSL)**

   * `BaseChain<Obj, D>` with `.prop(...)`, `.self()/.other()`, dynamic method section `._`, `.build()/.value()`, `.traverse()`, `.peers()`.
   * No per‑op wiring; `._` pushes `Invoke` with normalized `ArgRef[]`.

8. **Traversal Layer (Aggregation)**

   * `Traversal<A>` with `.map`, `.compact`, boolean reducers (`any/all/none`), numeric reducers (`sum/min/max`), generic `.fold(Monoid, f)`, and domain `.reduceBy("op")`.

9. **Mini‑DSL Facades**

   * Example: Vector DSL exposes `vectorExpr`, `vectorMapChain`, … created from a `DomainAdapter<Vector>`.

---

## 3. Abstract Syntax (IR)

### 3.1 Types

* `ArgRef<D>` ::=
  `ConstD(value: D)` | `ConstS(value: number)` | `PropRef(name: string)` | `OfRef(key: string, prop: string)` | `NestedExpr(expr: DomainExpr<D>)` | `Current`
* `Step<D>` ::=
  `Select(prop: string)` | `Switch(to: Self|Other|Key|Index, key?: string|number)` | `Invoke(op: string, args: ArgRef<D>[])`
* `Program<D>` ::= `Step<D>[]`

### 3.2 Normalization of Arguments (Surface → IR)

Given a runtime argument `a` passed in the surface DSL:

* If `typeof a === "number"` ⇒ `ConstS(a)`.
* Else if `a` is a `DomainExpr` proxy ⇒ `NestedExpr(a._expr)`.
* Else if `Array.isArray(a)` and `[key, prop]` are both strings ⇒ `OfRef(key, prop)`.
* Else if `typeof a === "string"` ⇒ `PropRef(a)`.
* Else ⇒ `ConstD(a)` (MUST be validated by adapter at invoke time).

**Note**: `ConstD` **MUST NOT** be used to smuggle non‑domain values; `isInstance` guards at invocation.

---

## 4. Static Semantics (Well‑Formedness)

A **Chain Program** is well‑formed iff:

1. The program contains at least one `Select` before the first `Invoke`.
   Otherwise, `build()`/`value()` MUST return `none`.
2. `Switch(to=Other)` without an explicit key is only defined when `scope.keys().length === 2`.
   Otherwise, the evaluator MUST yield `none` from the point of use (see §6).
3. `PropRef(name)` and `OfRef(key, prop)` refer to properties whose runtime values satisfy `adapter.isInstance`.
   Otherwise the evaluator MUST yield `none` for that argument.
4. Any `Invoke` applied to a non‑domain current value MUST yield `none`.

**Optional (typing extension)**: An implementation MAY refine `methodReturns(op)` to detect terminals (scalar/boolean) and reject subsequent domain invocations at compile time; when omitted, the runtime rule (4) applies.

---

## 5. Dynamic Semantics (Evaluation)

Let `⟦Program⟧(initial: Optional<D>, scope?: Scope<D>) : Optional<any>` denote evaluation.

The evaluator processes steps in order, maintaining `cur: Optional<any>`.

1. **Switch**

   * Requires `scope`.
   * `Self(key)` sets focus to `key` (string) or index (number).
   * `Other(key?)` flips focus when `|keys| = 2`; with `key` provided, sets explicit focus by key/index.
   * `Key(k)` sets focus by key; `Index(i)` by index.
   * `cur` is unchanged.
2. **Select(prop)**

   * Requires `scope`.
   * `cur := scope.getPropOpt(prop)` (an `Optional<D>`).
3. **Invoke(op, args)\`**

   * If `cur` is `none` ⇒ `cur := none`.
   * Else let `self := cur` (domain value).

     * If `!adapter.isInstance(self)` ⇒ `cur := none`.
     * Else fetch `method := adapter.getMethod(self, op)`; if missing ⇒ `cur := none`.
     * Evaluate each `ArgRef` to `Optional<any>` using:

       * `ConstD(v)` → `some(v)`
       * `ConstS(n)` → `some(n)`
       * `PropRef(name)` → `scope.getPropOpt(name)`
       * `OfRef(k, p)` → `scope.getPropOfOpt(k, p)`
       * `NestedExpr(e)` → `e.build(adapter)(cur, scope)`
       * `Current` → `cur`
     * Sequence all arguments via `sequenceArrayOpt`. If any `none` ⇒ `cur := none`.
     * If method has attached metadata `meta := (method as any)[DSL_OP_META]`, and `meta.liftScalar` is set, **scalar lift** each numeric arg with `adapter.fromScalar` according to the rule (see §7.2).
     * Finally: `cur := some(method.apply(self, callArgs))`, wrapped in `try/catch` (exceptions ⇒ `none`).

**Totality**: Evaluation is **total** and returns an `Optional`. No throws.

---

## 6. Optional Semantics (Error Handling Policy)

* All *missing data*, *type mismatches*, *unknown methods*, *invalid switches*, and *runtime exceptions in domain methods* **MUST** map to `none`.
* Reducers (Traversal) operate over arrays of `Optional<A>`. The default policy is **lenient**:

  * For `any/all/none/sum/min/max/fold` we operate over *present* elements, ignoring `none`.
    (An implementation MAY expose a **strict mode** in which any `none` collapses the reduction to `none`.)
* Surfaces (`value`, `traverse`, `peers`, `reduceBy`) **MUST NOT** throw; they return `Optional` or total primitives.

---

## 7. Adapter & Op Metadata

### 7.1 `DomainAdapter<D>` (Normative API)

```ts
interface DomainAdapter<D> {
  name: string;
  isInstance(v: unknown): v is D;
  getMethod(self: D, name: string): ((...a: any[]) => any) | undefined;
  fromScalar?: (n: number) => D;                 // optional
  methodReturns?(name: string): ValueKind;       // optional: Domain|Scalar|Boolean|Unknown
}
```

* `isInstance` **MUST** be a precise runtime type guard; false positives are illegal.
* `getMethod` **MUST** return `undefined` for unknown names.
* `fromScalar` enables scalar lifting (§7.2); if absent, numeric args remain numeric.

### 7.2 Op Metadata (Prototype‑attached)

Each domain method MAY carry an **op metadata** object stored under `DSL_OP_META` on the function value:

```ts
type OpMeta = {
  liftScalar?: boolean | boolean[]; // true → all numeric args; [b0,b1,…] → per-arg
  commutative?: boolean;
  associative?: boolean;
  pure?: boolean;
}
```

* **Scalar Lift**: When present, the evaluator **MUST** transform numeric args into domain instances with `adapter.fromScalar` according to the `liftScalar` rule. If `fromScalar` is absent, lifting is a no‑op.
* **Commutative/Associative**: These are *algebraic hints*; the evaluator MAY exploit them (e.g., for parallel folds). The semantics are unaffected.

---

## 8. Scopes (Navigation & Environment)

A `Scope<D>` represents the object space and current focus.

```ts
interface Scope<D> {
  getPropOpt(prop: string): Optional<D>;
  getPropOfOpt(key: string, prop: string): Optional<D>;
  setFocusByKey(key: string): void;
  setFocusByIndex(index: number): void;
  setFocusToOther(): void;        // only defined when |keys|=2
  currentKey(): string;
  keys(): string[];
}
```

Implementations:

* **MapScope**: keys are object keys. `other()` flips focus only if `keys().length === 2`; otherwise the call **MUST** cause subsequent evaluation to become `none` for that step’s dependency.
* **ArrayScope**: sugar over MapScope with keys `"0".."n-1"`.
* **MatrixScope**: keys are `"i,j"`. `other()` is **undefined** (MUST cause `none` if invoked without an explicit key).

All `get*` accessors return `Optional<D>` — never throw.

---

## 9. Chains (Surface Language)

### 9.1 Construction

* `mapChain<Obj, D>(adapter, map: Record<string, Obj>) : Chain<Obj,D>`
* `arrayChain<Obj, D>(adapter, arr: Obj[]) : Chain<Obj,D>`
* `matrixChain<Obj, D>(adapter, grid: Obj[][]) : Chain<Obj,D>`

`Chain<Obj,D>` exposes:

* `.prop<P extends KeysOfType<Obj,D>>(name: P)` — **MUST** be called before any method invocation.
* `.self(key?: string|number)` — set focus to self (or specific key/index).
* `.other(key?: string|number)` — set focus to other (pair) or to explicit key/index.
* `._.<op>(...args)` — record an `Invoke(op, normalizeArgs(args))`. Works for *any* method name.
* `.build() : (start: string|number) => Optional<any>`
* `.value(start)` — shorthand for `build()(start)`

### 9.2 Traversal & Peer Exploration

After forming a base chain:

* `.traverse(expr?: DomainExpr<D>) : Traversal<R>`
  Replays the chain for each **start key** in order; if `expr` is provided, applies it to each base result.
* `.peers(expr?: DomainExpr<D>) : Traversal<R>`
  Replays the chain for each **peer** of the *current start* (call `.value(start)` first to set focus).

### 9.3 Expressions

* `DomainExpr<D>` is created via `domainExpr<D>()`, a Proxy that captures any method chain into IR steps.

  * `.select(prop)` pushes `Select(prop)` (used when the expr needs to start from a property in scope).
  * `.identity()` no‑op.
  * Any property access (e.g., `.add("size").subtract(1)`) is captured as `Invoke`.

* `expr.build(adapter) : (current: Optional<D>, scope?: Scope<D>) => Optional<any>`
  When used in `NestedExpr`, the *current* value is the base result of the chain at that point.

---

## 10. Traversal (Aggregation)

`Traversal<A>` represents a multiset of `Optional<A>` results. It supports:

* `results(): Optional<A>[]` — raw results.
* `map<B>(f: (a: A) => B): Traversal<B>` — pointwise map (Optional‑aware).
* `compact(): Traversal<NonNullable<A>>` — drop `null|undefined` values (keeps `none` out).
* **Boolean reducers**:
  `.any(f?) : boolean` (OR), `.all(f?) : boolean` (AND), `.none(f?) : boolean` (NOT any).
  Operate over *present* values (lenient policy).
* **Numeric reducers**:
  `.sum(f?) : number`, `.min(f?) : number|undefined`, `.max(f?) : number|undefined`.
* **Monoidal fold**:
  `.fold<M>(Monoid<M>, f: (a: A) => M) : Optional<M>` — ignores `none` by default.
* **Domain reduction**:
  `.reduceBy(op: string) : Optional<A>` — left‑fold using binary domain method `op` (e.g., `"add"`).

**Strictness policy**: Implementations MAY offer a strict variant (e.g., `.foldStrict`) where any `none` collapses the result to `none`.

---

## 11. Value Kinds (Optional Typing Extension)

The adapter MAY define `methodReturns(op) ∈ {Domain, Scalar, Boolean, Unknown}`. A typed implementation MAY:

* Track an **effect type** `K` for each `DomainExpr<D, K>` node.
* Reject at compile time any `Invoke` of domain methods after a non‑Domain terminal.
* Allow `.traverse()` / `.peers()` to be generically typed as `Traversal<K>`.

This is optional and **MUST NOT** be assumed by reducers (runtime semantics remain total).

---

## 12. Axes & Composition

The language has four orthogonal axes:

1. **Property axis** — `Select(prop)` picks a `D` from the current object.
2. **Start axis** — `.traverse()` iterates all starting keys.
3. **Peer axis** — `.peers()` iterates all *others* relative to the current start.
4. **Branch axis (optional extension)** — `fork(expr1, expr2, …)` splits into multiple expressions applied to the same base value; subsequent invocations **broadcast** to branches; `.values(start)` returns `Optional[]`.

**Composability**: Axes **MUST** commute where semantics are unambiguous. For example, applying an `expr` inside `.traverse()` is equivalent to post‑mapping the traversal (`.traverse().map(applyExpr)`), modulo Optional strictness.

---

## 13. Scalar‑Lift Semantics

When invoking a domain method:

* If method carries `liftScalar: true`, every numeric argument `n` **MUST** be transformed to `adapter.fromScalar(n)` prior to invocation, if `fromScalar` is defined.
* If `liftScalar: [b0, b1, …]`, only arguments at indices with `true` values are lifted.
* If `fromScalar` is absent, lifting is a no‑op (numeric args remain numbers).

---

## 14. Algebraic Laws (Recommended)

Provided domain methods respect the advertised metadata:

* **Commutativity**: `a.add(b) = b.add(a)` if method `add` is marked commutative.
* **Associativity**: `(a.add(b)).add(c) = a.add(b.add(c))` if associative.
* **Purity**: If `pure`, repeated evaluation with the same inputs must yield the same outputs.

These laws enable safe reordering or parallelization of `.reduceBy` and `.fold` but are **advisory**; breaking them violates the conformance of adapter metadata, not the evaluator.

---

## 15. Conformance Requirements

An implementation **conforms** to this specification if:

1. It implements layers (§2) such that each layer is independent and composable.
2. It implements IR and evaluation rules (§3–§6) exactly, including totality and Optional semantics.
3. It honors adapter and op metadata semantics (§7).
4. It implements scopes with Optional accessors (§8).
5. Its chain surface constructs only push normalized IR steps (§9.1–§9.3).
6. Its traversals implement lenient reducers by default (§10); strict variants MAY be provided explicitly.

---

## 16. Security & Side‑Effects

* The evaluator **MUST** catch exceptions thrown by domain method invocations and treat them as `none`.
* Domain methods MAY be impure; however, if a method is annotated `pure: true`, the adapter author warrants referential transparency under the DSL’s usage.

---

## 17. Caching & Memoization (Optional)

* Memoizing compiled expressions (`DomainExpr.build(adapter)`) by a stable encoding of `Step[]` **MAY** be implemented using `UnitalOptionalMap`.
* Caching **MUST NOT** alter semantics; it is a performance optimization only.

---

## 18. Examples (Normative)

### 18.1 Separation Test (pair) with boolean traversal

```ts
const sep =
  vectorMapChain({ A, B })
    .prop("position")._.add("size").other()._.subtract("position")
    .traverse( vectorExpr().anyNonPositive() )
    .any();                      // boolean
```

Semantics:

* For each start (`"A"`, `"B"`), evaluate `position + size - other.position` ⇒ `Optional<Vector>`.
* Apply `anyNonPositive()` per result ⇒ `Optional<boolean>`.
* `any()` OR‑reduces over present booleans ⇒ `boolean`.

### 18.2 Peer distances with numeric min

```ts
const minDist =
  vectorMapChain({ A, B, C, D })
    .self("A").prop("position")
    .peers( vectorExpr().subtract("position").length() )
    .min();               // number | undefined (lenient policy)
```

### 18.3 Domain reduction by method

```ts
const sumOffsetsOpt =
  vectorMapChain({ A, B, C })
    .self("A").prop("position")
    .peers( vectorExpr().subtract("position") )
    .reduceBy("add");    // Optional<Vector>
```

---

## 19. EBNF (Surface Shape; indicative)

This EBNF reflects *fluent TS calls*, not a textual grammar.

```
Chain          ::= MapChain | ArrayChain | MatrixChain ;
MapChain       ::= "mapChain" "(" Adapter "," Map ")" "." Pipeline ;
ArrayChain     ::= "arrayChain" "(" Adapter "," Array ")" "." Pipeline ;
MatrixChain    ::= "matrixChain" "(" Adapter "," Matrix ")" "." Pipeline ;

Pipeline       ::= Select ( Nav | Invoke )* ( Build | Traverse | Peers ) ;
Select         ::= "prop" "(" PropName ")"
Nav            ::= "self" "(" [ KeyOrIndex ] ")" | "other" "(" [ KeyOrIndex ] ")"
Invoke         ::= "._." OpName "(" ArgList ")"
Build          ::= "build" "(" ")" | "value" "(" Start ")"
Traverse       ::= "traverse" "(" [ Expr ] ")" "." Reducer
Peers          ::= "peers" "(" [ Expr ] ")" "." Reducer

Expr           ::= "domainExpr" "<" D ">" "(" ")" "." ( "select" "(" PropName ")" | OpName "(" ArgList ")" )*
ArgList        ::= [ Arg ( "," Arg )* ]
Arg            ::= Number | String | "[" String "," String "]" | Expr
Reducer        ::= "any" "(" [ Pred ] ")" | "all" "(" [ Pred ] ")" | "none" "(" [ Pred ] ")"
                 | "sum" "(" [ NumProj ] ")" | "min" "(" [ NumProj ] ")" | "max" "(" [ NumProj ] ")"
                 | "fold" "(" Monoid "," Proj ")"
                 | "reduceBy" "(" String ")"
```

---

## 20. Extension Points

* **Lenses**: Replace `prop(string)` with typed lenses for nested access (`Lens<Obj, D>`). Semantics unchanged (§5: Select uses lens get).
* **Strict Traversal**: Add `.strict()` on Traversal to switch reducers into “any none ⇒ none” mode.
* **Typed Op Names**: Adapter may expose a string‑literal union of known ops to type `.reduceBy` arguments.
* **Branch Axis**: Add `fork(...exprs): MultiChain`, broadcasting subsequent invokes and returning `Optional[]` via `.values(start)`; semantics are a map over `exprs` with shared base value.

---

## 21. Compliance Checklist (for implementers)

* [ ] No `.left`/`.right` used outside Optional’s own implementation.
* [ ] `normalizeArgs` produces only IR categories in §3.2.
* [ ] `evalProgram` implements §5 exactly; total and Optional‑first.
* [ ] Scalar lift honored according to metadata and `fromScalar`.
* [ ] `other()` without explicit key yields `none` unless pair scope.
* [ ] Traversal reducers lenient by default; strict variant (if present) opt‑in.
* [ ] Chain’s dynamic `._` pushes *exactly* one `Invoke` with normalized args (no hacks).
* [ ] DomainAdapter is precise and side‑effect free.

---

## 22. Glossary

* **Domain**: The concrete class `D` the DSL operates on (e.g., `Vector`).
* **Schema**: The object structure hosting domain values (`Obj`).
* **Start**: The focused object (by key or index) for which a chain evaluates.
* **Peer**: Any object in the same collection except the current start.
* **Lift**: Converting numeric arguments into domain values via `fromScalar`.

---

## 23. Versioning

* v0.9 — Initial comprehensive specification (Optional‑first; adapters; scopes; IR; traversals; algebra; metadata).

Backward‑compatible changes include: adding new reducers, new metadata fields (ignored by older impls), new traversal policies gated by explicit opt‑in.

---

### Appendix A — Reference Equivalences

Let `C` be a chain ending in a base value `b: Optional<D>` for a given start.

* `C.traverse(E).map(F)` ≡ `C.traverse((x) => F(E(x)))`
* `C.peers(E).map(F)`     ≡ `C.peers((x) => F(E(x)))`
* If `op` is associative, `reduceBy(op)` is invariant to parenthesization.

---

### Appendix B — Worked Example (Vector)

**Goal:** inclusive coverage rectangle → grid

```
p1 = floor(position / cell)
p2 = floor((position + size - 1) / cell)
```

**DSL:**

```ts
const cell = Vector.scalar(cellSize);

const gridBounds =
  vectorMapChain({ b })
    .prop("position")
    .traverse(
      vectorExpr().select("position") // optional; base is already position
    ); // returns Traversal<Vector>

const [p1Opt, p2Opt] =
  vectorMapChain({ b })
    .prop("position")
    .peers( // use branch axis alternatively via fork extension
      vectorExpr().identity(),
    ).results(); // illustration only

// Canonical with fork (extension):
// position → [position, position + size - 1] → divide(cell) → floor()
```

Semantics: see §5 and §10.

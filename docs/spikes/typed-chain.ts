// Scratch sketch (not part of any repo): typed defineDomain + typed `._` proxy + type-state chain.
// Goal: verify the API shape type-checks and rejects nonsense, under `tsc --strict`.

// ---------------- Optional / Result (minimal) ----------------
type VexError =
  | { readonly code: "#REF"; readonly key: string; readonly step: number }      // unknown key / bad focus move
  | { readonly code: "#N/A"; readonly prop: string; readonly step: number }     // missing property
  | { readonly code: "#VALUE"; readonly expected: string; readonly step: number } // wrong kind
  | { readonly code: "#NAME"; readonly op: string; readonly step: number }      // unknown op
  | { readonly code: "#THROW"; readonly op: string; readonly cause: unknown; readonly step: number };
type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: VexError };

// ---------------- Domain definition ----------------
type Law = "commutative" | "associative" | "idempotent";
interface OpMeta { readonly laws?: readonly Law[]; readonly liftScalar?: boolean; readonly pure?: boolean }

type MethodKeys<D> = { [K in keyof D]: D[K] extends (...a: any[]) => any ? K : never }[keyof D] & string;

interface Domain<Name extends string, D, Ops extends Partial<Record<MethodKeys<D>, OpMeta>>> {
  readonly name: Name;
  readonly is: (u: unknown) => u is D;
  readonly fromScalar?: (n: number) => D;
  readonly ops: Ops; // registry OWNED by the domain value: no prototype mutation, tree-shakable
}
type AnyDomain = Domain<string, any, any>;
type DomainT<Dm> = Dm extends Domain<string, infer D, any> ? D : never;
type OpNames<Dm> = Dm extends Domain<string, infer D, infer Ops> ? keyof Ops & MethodKeys<D> : never;
type OpFn<Dm, M extends string> = M extends keyof DomainT<Dm> ? DomainT<Dm>[M] : never;
type OpParams<Dm, M extends string> = OpFn<Dm, M> extends (...a: infer P) => any ? P : never;
type OpReturn<Dm, M extends string> = OpFn<Dm, M> extends (...a: any[]) => infer R ? R : never;
type Lifts<Dm, M extends string> =
  Dm extends Domain<string, any, infer Ops> ? (M extends keyof Ops ? (Ops[M] extends { liftScalar: true } ? true : false) : false) : false;

function defineDomain<const Name extends string, D, const Ops extends Partial<Record<MethodKeys<D>, OpMeta>>>(
  spec: Domain<Name, D, Ops>,
): Domain<Name, D, Ops> {
  return Object.freeze(spec);
}

// ---------------- A demo domain ----------------
class Vector {
  constructor(readonly x: number, readonly y: number) {}
  static scalar(n: number) { return new Vector(n, n); }
  add(o: Vector): Vector { return new Vector(this.x + o.x, this.y + o.y); }
  subtract(o: Vector): Vector { return new Vector(this.x - o.x, this.y - o.y); }
  scale(k: number): Vector { return new Vector(this.x * k, this.y * k); }
  length(): number { return Math.hypot(this.x, this.y); }
  equals(o: Vector): boolean { return this.x === o.x && this.y === o.y; }
}

const VectorDomain = defineDomain({
  name: "Vector",
  is: (u: unknown): u is Vector => u instanceof Vector,
  fromScalar: (n: number) => Vector.scalar(n),
  ops: {
    add: { laws: ["commutative", "associative"], liftScalar: true },
    subtract: { liftScalar: true },
    scale: {},
    length: {},
    equals: { laws: ["commutative"] },
  },
});

// ---------------- Typed program surface ----------------
type Obj = Record<string, unknown>;
type PropsOfType<O, T> = { [P in keyof O]-?: O[P] extends T ? P : never }[keyof O] & string;

declare const ExprBrand: unique symbol;
interface Expr<T> { readonly [ExprBrand]: T } // nested sub-expression producing T (opaque here)

// What may appear in an argument position whose declared parameter type is T:
type Arg<T, O, K extends string, Dm, Lift extends boolean> =
  | T                                         // a literal value / domain constant
  | PropsOfType<O, T>                         // relative ref: prop of the focused object (A1 relative)
  | readonly [K, PropsOfType<O, T>]           // absolute ref: [key, prop] (like $A$1)
  | Expr<T>                                   // nested sub-expression
  | (Lift extends true ? (T extends DomainT<Dm> ? number : never) : never); // scalar lifting only if declared

type MapArgs<P extends readonly unknown[], O, K extends string, Dm, Lift extends boolean> = {
  [I in keyof P]: Arg<P[I], O, K, Dm, Lift>;
};

// Type-state: what is the current pipeline value? (Domain value vs scalar vs boolean)
interface ChainBase<Dm extends AnyDomain, O extends Obj, K extends string, Cur> {
  prop<P extends PropsOfType<O, DomainT<Dm>>>(p: P): DomainChain<Dm, O, K>;
  self(k: K): this;
  other(): this;
  run(start: K): Result<Cur>;
  explain(start: K): ReadonlyArray<{ step: number; label: string; result: Result<unknown> }>;
  traverse(): { readonly [P in K]: Result<Cur> };     // = extend + "forget focus" (comonad)
  peers(start: K): { readonly [P in K]?: Result<Cur> }; // = experiment(s => keys \ {s})
}
type OpsProxy<Dm extends AnyDomain, O extends Obj, K extends string> = {
  [M in OpNames<Dm>]: (...args: MapArgs<OpParams<Dm, M>, O, K, Dm, Lifts<Dm, M>>) => NextChain<Dm, O, K, OpReturn<Dm, M>>;
};
type NextChain<Dm extends AnyDomain, O extends Obj, K extends string, R> =
  [R] extends [DomainT<Dm>] ? DomainChain<Dm, O, K> : ValueChain<Dm, O, K, R>;
interface DomainChain<Dm extends AnyDomain, O extends Obj, K extends string> extends ChainBase<Dm, O, K, DomainT<Dm>> {
  readonly _: OpsProxy<Dm, O, K>; // only available when the current value is a domain value
}
interface ValueChain<Dm extends AnyDomain, O extends Obj, K extends string, R> extends ChainBase<Dm, O, K, R> {
  // no `._` here: calling a domain op on a number/boolean is a compile error
}

declare function chain<Dm extends AnyDomain, const C extends Record<string, Obj>>(
  dom: Dm, coll: C,
): ValueChain<Dm, C[keyof C & string], keyof C & string, undefined>;

// ---------------- Usage ----------------
type Box = { position: Vector; size: Vector; name: string; weight: number };
declare const A: Box, B: Box;

const c = chain(VectorDomain, { A, B });

const ok1 = c.prop("position")._.add("size").other()._.subtract("position").run("A"); // Result<Vector>
const ok2 = c.prop("position")._.add(5).run("A");                                      // scalar lift (add declares liftScalar)
const ok3 = c.prop("position")._.add(["B", "size"]).run("A");                         // absolute ref
const ok4 = c.prop("position")._.length().run("B");                                    // Result<number>
const ok5 = c.prop("position")._.scale("weight").run("A");                             // number-typed prop as number arg
const all = c.prop("position")._.subtract(["B", "position"]).traverse();               // { A: Result<Vector>; B: Result<Vector> }

const check1: Result<Vector> = ok1;
const check4: Result<number> = ok4;
void [ok2, ok3, check1, check4, ok5, all];

// ---------------- Must NOT compile ----------------
// @ts-expect-error unknown op name
c.prop("position")._.nope();
// @ts-expect-error 'name' is a string prop, not a Vector prop
c.prop("position")._.add("name");
// @ts-expect-error 'subtract' declared liftScalar, but 'equals' did not: no scalar lifting
c.prop("position")._.equals(3);
// @ts-expect-error unknown key in absolute ref
c.prop("position")._.add(["C", "size"]);
// @ts-expect-error after length() the value is a number: no `._`
c.prop("position")._.length()._.add("size");
// @ts-expect-error prop() only accepts props holding domain values
c.prop("weight");
// @ts-expect-error unknown start key
c.prop("position").run("Z");

export {};

// ---------------- No `any` leakage (these must fail) ----------------
// @ts-expect-error ok1 is Result<Vector>, not Result<string>
const leak1: Result<string> = ok1;
// @ts-expect-error ok4 is Result<number>, not Result<Vector>
const leak2: Result<Vector> = ok4;
// @ts-expect-error traverse result is keyed by A|B only
all.C;
void [leak1, leak2];

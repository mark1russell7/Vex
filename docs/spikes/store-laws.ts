// Scratch: Store comonad over a finite keyed collection (focus = key), with law checks.
// Models Vex's scope: `self(k)` = seek, `traverse(p)` = extend(p), `peers(p)` = experiment(keys \ {pos}).

interface Store<K, A> {
  readonly keys: readonly K[];
  readonly peek: (k: K) => A; // total over `keys` (Vex would make this Optional)
  readonly pos: K;
}
const extract = <K, A>(w: Store<K, A>): A => w.peek(w.pos);
const seek = <K, A>(k: K, w: Store<K, A>): Store<K, A> => ({ keys: w.keys, peek: w.peek, pos: k });
const extend = <K, A, B>(f: (w: Store<K, A>) => B) => (w: Store<K, A>): Store<K, B> => {
  // "Representable" memo: tabulate over the finite key set once (cf. adjunctions' Representable Store)
  const memo = new Map<K, B>();
  for (const k of w.keys) memo.set(k, f(seek(k, w)));
  return { keys: w.keys, peek: (k: K) => memo.get(k) as B, pos: w.pos };
};
const experiment = <K, A>(f: (k: K) => readonly K[], w: Store<K, A>): A[] => f(w.pos).map(w.peek);
const peers = <K, A, B>(p: (w: Store<K, A>) => B, w: Store<K, A>): B[] =>
  experiment((s) => w.keys.filter((k) => k !== s), extend(p)(w));

// ---------- tiny PRNG + generators ----------
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const genStore = (): Store<string, number> => {
  const n = 1 + Math.floor(rnd() * 6);
  const keys = Array.from({ length: n }, (_, i) => "k" + i);
  const vals = new Map(keys.map((k) => [k, Math.floor(rnd() * 100) - 50] as const));
  return { keys, peek: (k) => vals.get(k)!, pos: keys[Math.floor(rnd() * n)] };
};
// "programs" = coKleisli arrows Store -> number (relative refs, absolute refs, neighbourhood reads)
const programs: Array<(w: Store<string, number>) => number> = [
  (w) => extract(w) * 2,                                   // relative: my own value
  (w) => extract(w) + w.peek(w.keys[0]),                   // absolute ref ($A$1-style)
  (w) => experiment((s) => w.keys.filter((k) => k !== s), w).reduce((a, b) => a + b, 0), // sum of peers
  (w) => { const i = w.keys.indexOf(w.pos); return w.peek(w.keys[(i + 1) % w.keys.length]) - extract(w); }, // R[+1] relative
];
const pick = () => programs[Math.floor(rnd() * programs.length)];
const sameStore = <K, A>(a: Store<K, A>, b: Store<K, A>) =>
  a.pos === b.pos && a.keys.length === b.keys.length && a.keys.every((k) => Object.is(a.peek(k), b.peek(k)));

let failures = 0;
const law = (name: string, ok: boolean) => { if (!ok) { failures++; console.log("FAIL", name); } };

for (let t = 0; t < 2000; t++) {
  const w = genStore(), f = pick(), g = pick();
  // Comonad laws
  law("extend extract = id", sameStore(extend<string, number, number>(extract)(w), w));
  law("extract . extend f = f", extract(extend(f)(w)) === f(w));
  law("extend f . extend g = extend (f . extend g)",
    sameStore(extend(f)(extend(g)(w)), extend((v: Store<string, number>) => f(extend(g)(v)))(w)));
  // Store (ComonadStore) laws
  const s = w.keys[Math.floor(rnd() * w.keys.length)], u = w.keys[Math.floor(rnd() * w.keys.length)];
  law("peek pos = extract", w.peek(w.pos) === extract(w));
  law("pos (seek s w) = s", seek(s, w).pos === s);
  law("seek s . seek u = seek s", sameStore(seek(s, seek(u, w)), seek(s, w)));
  // Vex-specific derived laws
  law("traverse(p) at k = p(seek k)", w.keys.every((k) => extend(f)(w).peek(k) === f(seek(k, w))));
  law("peers(p) = traverse(p) minus self",
    JSON.stringify(peers(f, w)) === JSON.stringify(w.keys.filter((k) => k !== w.pos).map((k) => extend(f)(w).peek(k))));
  if (w.keys.length === 2) {
    const other = (v: Store<string, number>) => seek(v.keys.find((k) => k !== v.pos)!, v);
    law("other . other = id (pairs)", sameStore(other(other(w)), w));
  }
}
console.log(failures === 0 ? "all laws hold on 2000 random cases" : `${failures} failures`);

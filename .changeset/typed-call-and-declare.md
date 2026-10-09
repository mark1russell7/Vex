---
"@mark1russell7/vex": minor
"@mark1russell7/vex-domains": patch
"@mark1russell7/vex-testkit": patch
---

Add typed free functions: `vex(...).withOptions({ fns })` keeps the types of the functions, and `chain.call(name, ...args)` applies one with typed arguments and a typed result. Add `sheet().declare<T>()`, so a column can read itself or a later column with its type. `NDVector.get` and the test kit have small clean-ups, and every published package has a coverage gate.

# @mark1russell7/vex-testkit

## 0.3.0

### Patch Changes

- cb86b41: Add a README to each package (an example that a test checks, the features and the links), and the keywords, homepage, bugs and author fields.
- 07e271e: Add typed free functions: `vex(...).withOptions({ fns })` keeps the types of the functions, and `chain.call(name, ...args)` applies one with typed arguments and a typed result. Add `sheet().declare<T>()`, so a column can read itself or a later column with its type. `NDVector.get` and the test kit have small clean-ups, and every published package has a coverage gate.
- Updated dependencies [cb86b41]
- Updated dependencies [07e271e]
  - @mark1russell7/vex@0.3.0

## 0.2.0

### Minor Changes

- 855fcd5: Publish under the npm names `@mark1russell7/vex`, `@mark1russell7/vex-domains` and `@mark1russell7/vex-testkit`. The type `Optional` is the Optional of the family (`@mark1russell7/optional`); the declarations hold a copy of it, so there is no new runtime dependency.
- 6eff59c: Add sheets (`root.sheet()`, `cell()`, `#CYCLE!` with Tarjan's algorithm), `compile()` (the interpreter is now a closure compiler), `root.ext()`, and the location of extension errors (EVAL.LOCATION).
- c7983f5: Add tree spaces: `space.tree(records, parents)`, the move `parent()`, and the axes `children`, `ancestors`, `descendants` and `siblings`. The test kit generates tree spaces, and property P11 checks the tree axes against the parents.

### Patch Changes

- Updated dependencies [855fcd5]
- Updated dependencies [6eff59c]
- Updated dependencies [c7983f5]
  - @mark1russell7/vex@0.2.0

# @mark1russell7/vex

## 0.2.0

### Minor Changes

- 855fcd5: Publish under the npm names `@mark1russell7/vex`, `@mark1russell7/vex-domains` and `@mark1russell7/vex-testkit`. The type `Optional` is the Optional of the family (`@mark1russell7/optional`); the declarations hold a copy of it, so there is no new runtime dependency.
- 6eff59c: Add sheets (`root.sheet()`, `cell()`, `#CYCLE!` with Tarjan's algorithm), `compile()` (the interpreter is now a closure compiler), `root.ext()`, and the location of extension errors (EVAL.LOCATION).
- c7983f5: Add tree spaces: `space.tree(records, parents)`, the move `parent()`, and the axes `children`, `ancestors`, `descendants` and `siblings`. The test kit generates tree spaces, and property P11 checks the tree axes against the parents.

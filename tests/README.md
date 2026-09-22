# Tests

`ipc.test.mjs` imports `@beyond-js/ipc/main`, `@beyond-js/ipc/wrapper` and `@beyond-js/ipc/errors` under BEE Node from an Engine development server that compiles this package, and forks `child.mjs`, which imports `@beyond-js/ipc/child` with the same loader arguments. `@beyond-js/pending-promise` and `@beyond-js/kernel` must resolve from the working directory.

```sh
BEE_URL=<servers> BEE_ADAPTER=engine node --import "$BEE_NODE_DIR/register.mjs" --test tests/*.test.mjs
```

Inside the Beyond Suite, `node utils/validation/run.mjs ipc` prepares the servers and runs it. [The validation guide](../docs/validation.md) maps the file to its contracts.

## Conventions

These files follow the normative conventions of the Beyond Suite testing guide (testing v1): Node's own test runner, one process per file; the public specifier a consumer imports and never a source file; readiness, events and answers awaited rather than time, with the runner's timeout bounding every wait; whatever a test creates (a directory, a process, a service) removed with `t.after`, on failure as well; and outcomes asserted, error paths by their diagnostic code where the object reports one. They are not run by `beyond test`: that command tests the packages Packages compiles, and this one is compiled by Engine, so the runner is given the loader and the servers instead. For the same reason the files sit in `tests/` and not beside the module sources, since Engine takes every file of a module directory as an input.

`child.mjs` is the fixture process, not a test file. Its `exit` action leaves the channel a moment to write the answer before the process exits, because nothing reports when a message was written; the tests themselves wait for answers only, relying on the order in which one channel delivers.

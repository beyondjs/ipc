# Tests

`ipc.test.mjs` imports `@beyond-js/ipc/main`, `@beyond-js/ipc/wrapper` and `@beyond-js/ipc/errors` under BEE Node from an Engine development server that compiles this package, and forks `child.mjs`, which imports `@beyond-js/ipc/child` with the same loader arguments. `@beyond-js/pending-promise` and `@beyond-js/kernel` must resolve from the working directory.

```sh
BEE_URL=<servers> BEE_ADAPTER=engine node --import "$BEE_NODE_DIR/register.mjs" --test tests/*.test.mjs
```

Inside the Beyond Suite, `node utils/validation/run.mjs ipc` prepares the servers and runs it. [The validation guide](../docs/validation.md) maps the file to its contracts.

## Conventions

These files follow the normative conventions of the Beyond Suite testing guide (testing v1): Node's own test runner, one process per file; the public specifier a consumer imports and never a source file; readiness, events and answers awaited rather than time, with the runner's timeout bounding every wait; whatever a test creates (a directory, a process, a service) removed with `t.after`, on failure as well; and outcomes asserted, error paths by their diagnostic code where the object reports one. They are not run by `beyond test`: that command tests the packages Packages compiles, and this one is compiled by Engine, so the runner is given the loader and the servers instead. For the same reason the files sit in `tests/` and not beside the module sources, since Engine takes every file of a module directory as an input.

`child.mjs` is the fixture process, not a test file. Its `exit` action leaves the channel a moment to write the answer before the process exits, because nothing reports when a message was written; the tests themselves wait for answers only, relying on the order in which one channel delivers.

## Fixtures and inline inputs

`child.mjs` is the one checked-in fixture: the child process `ipc.test.mjs` forks under the name given as its first argument. It imports `@beyond-js/ipc/child` and installs the actions the tests call (`ping`, `error`, `throw`, `cyclic`, `call`, `hang`, `exit`, `subscribe`, `unsubscribe`, `received`). It is run, not edited, so it is not copied. The messages, action parameters and thrown values the tests send are small protocol payloads and stay inline.

## Test organization and source fixtures

These rules are shared by every Beyond repository.

- Contract/unit and integration tests live in `test/` or `tests/`; complete journeys against an installed, composed or exported product live in `acceptance/`, with a README of their own. Harness infrastructure (servers, registries, process lifecycle, copying and substitution) lives in a `support/` directory of the consuming area.
- Applications, packages, modules, documents and assets a test exercises are checked-in files with their real extensions and directory structure under the consuming area's `fixtures/`. Each fixture group has a README naming its purpose, entry modules, the tests that use it, their command, the expected behavior and any intentionally invalid part. A reader inspects the example without running or decoding a generator.
- A harness copies the fixtures it runs or edits to a unique temporary directory, substitutes only explicit values such as versions, ports or origins, and never writes the checked-in files, even when a run fails. Credentials, machine paths and build output are never fixture source.
- Small input values, expected values, protocol payloads and short edits stay inline. Source is generated only when generation is the behavior under test (size or memory stress, combinations, deliberately malformed input); the guide states why, the parameters that reproduce it and how to inspect what was generated.
- Fixtures stay out of the repository's production compilation, discovery and packaging.
- Migrating a test preserves its scenario identities, its positive, negative and recovery cases and its real execution path; an existing failure stays reported as a failure.

# @beyond-js/ipc

Route actions and origin-qualified events between a Node parent and its registered child processes.

Read [architecture, APIs and lifecycle](docs/architecture.md) before integrating the package. The guide explains configuration, execution flow, source limitations and verification cases. Public Beyond modules are **main, child, wrapper, dispatcher, errors and types**; their module manifests and marked bundle exports define the API.

This checkout is authored with Beyond. [beyond.json](beyond.json) selects [package.json](package.json), whose module root is `modules`. Source module directories are not plain Node entrypoints; compiled public modules and their dependencies must be available to the consumer.

Use `detach(action)` to remove a handler; there is no `unhandle`. The wrapper requires global `bimport` and initializes asynchronously. IPC registration does not create a fork or await readiness. Requests have no built-in timeout/disconnect rejection, and event unsubscription/teardown require the [documented repairs](docs/architecture.md#lifecycle-and-failure-boundaries).

The build/test prerequisites and gaps are documented in the guide. No generic npm test/build command is supplied by the source manifest.

MIT; see [LICENSE](LICENSE).

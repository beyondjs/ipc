# Validation

The contracts of IPC and the tests that establish them, executed with real forked children (`tests/child.mjs`) started under the loader of the test process. Inside the Beyond Suite, `node utils/validation/run.mjs ipc` prepares the servers; [the tests guide](../tests/README.md) states the prerequisites.

| Contract or risk | Test | Observed |
| --- | --- | --- |
| The four routes, including a child calling main through another child | `ipc` 1 | every answer as expected |
| The wrapper selects the main handler and shares its handlers | `ipc` 2 | `exec` through the wrapper answers |
| Unknown handler and target on every route; a handler installed later; `detach` | `ipc` 3 | named errors; the later handler answers; detached action refused |
| Error cause chains and stacks travel; `print` formats them | `ipc` 4 | `top`, `middle`, `base`; the child's stack preserved |
| Falsy and non-Error throws reject; a cyclic cause is cut | `ipc` 5 | `null`, `false`, `0` reject with an `Error`; a string keeps its text; `[circular cause]` |
| Serialization of values and cycles in-process; hostile `toJSON` | `ipc` 6 | strings as they are; `null`, `undefined`; string form when JSON throws; cycle cut and deserialized |
| First subscription registers, last release unregisters in the parent; origins distinct | `ipc` 7 | `subscriptions()` reflects both; nothing arrives after release |
| The parent subscribes to a child origin and to itself; `off` keeps identity; `\|` refused | `ipc` 8 | as documented |
| A bogus response is logged and ignored; duplicate and reserved names refused; unknown unregister refused | `ipc` 9 | as documented |
| A child that exits rejects its pending requests; a later request fails | `ipc` 10 | `disconnected`; then `not found` after unregistering |
| Unregistering rejects what the child owed; `destroy()` releases everything | `ipc` 11 | `destroyed` for both; `not found` afterwards |

## Not established

- Backpressure and very large payloads: no measurement.
- A child that is alive and never answers: by design it stays pending, and no timeout policy exists to test.
- Serialization through the `advanced` fork serializer: the tests use the default JSON channel.
- Concurrency limits: no stress with thousands of simultaneous requests.

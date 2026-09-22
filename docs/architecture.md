# IPC actions, events and lifecycle

Beyond IPC coordinates Node parent and child processes over the channel `child_process.fork` provides. The parent names and registers children, executes local actions and routes requests and events between them. IPC does not fork processes, start services, authenticate callers or reconnect them.

## Public modules

[package.json](../package.json) selects the Beyond module root `modules`. Every manifest is a TypeScript bundle; the package has no plain Node entry.

| Public module | API |
| --- | --- |
| `@beyond-js/ipc/main` | [ipc singleton](../modules/main/index.ts) of the parent: registration, actions, events |
| `@beyond-js/ipc/child` | [ipc singleton](../modules/child/index.ts) of a forked child |
| `@beyond-js/ipc/wrapper` | [ipc singleton](../modules/wrapper/index.ts) that selects main or child by the presence of a channel, through the Beyond runtime's `bimport` |
| `@beyond-js/ipc/dispatcher` | [Dispatcher](../modules/dispatcher/index.ts): request and response correlation over one channel |
| `@beyond-js/ipc/errors` | [SerializableError and IErrorModel](../modules/errors/serializable.ts) |
| `@beyond-js/ipc/types` | [Handler and listener types, message shapes](../modules/types/index.ts) |

`MainProcessHandler` and `ChildProcessHandler` are internal exports; the singletons are the public boundary.

## Choosing a handler

`main` is for the parent, `child` for a fork with `process.send`. Importing `child` without a channel warns and its dispatcher throws; importing `main` inside a child warns. The wrapper resolves the right one asynchronously: `exec` awaits it, the other calls run once it is loaded, and a failure to load it (no `bimport`, or the module missing) rejects `exec` and is reported for the others instead of leaving them pending.

## Main and child API

| Method | Behaviour |
| --- | --- |
| `handle(action, callback)`, `detach(action)` | Set or remove the local callback of an action; the callback receives spread positional parameters and may return a promise |
| `exec(target, action, ...params)` | Execute locally when the target is `main` in the parent; route otherwise and return the correlated promise |
| `on(origin, event, listener)`, `off(origin, event, listener)` | Subscribe to or release the exact origin and event pair; identity of the listener matters. Names cannot contain `\|` |
| `emit(event, data)`, `notify` (deprecated) | Emit one payload from this process; the origin is the process name (`main` for the parent) |
| `register(name, fork)`, `unregister(name)` | Parent only; `main` is reserved; a name registered twice is refused. Registration installs routing and nothing else; unregistering rejects the requests the child still owes |
| `events.subscriptions(name)` | Parent only: the keys a registered child is subscribed to, for diagnostics |
| `destroy()` | Parent: releases every child router and every local subscription, rejecting pending requests; local action handlers stay. Child: releases its listeners and its dispatcher |

Readiness is the application's: a request sent before a child installed its handler is answered with `No handler registered for action "<name>"`, and a handler installed later answers the next request.

## Actions and the wire contract

A [Dispatcher](../modules/dispatcher/index.ts) is bound to one child in the parent, or to `process` in a child. `exec` allocates a UUID, records a pending promise, sends `{ type: 'ipc.request', id, target, action, params }` and returns the promise. A response `{ type: 'ipc.response', request, data, error }` settles it. A send that fails synchronously or reports an error rejects the request; a `disconnect` of the channel or the `exit` of the fork rejects every pending request (`IPC channel disconnected before the request was answered`); `destroy()` rejects them too (`IPC dispatcher destroyed before the request was answered`). `pending` counts them. There is no timeout: a child that is alive and never answers keeps the request pending, by design, and adding a policy is a compatibility decision.

| Route | Path |
| --- | --- |
| main → main | Local action, no serialization |
| main → child | The child's router dispatches to the child's handler; the response returns to the dispatcher |
| child → main | The child's dispatcher; the parent's router for that child executes the parent's action and answers with the original identifier |
| child → child | The origin's request reaches its parent router, which dispatches to the target child under a new identifier and answers the origin with its own |

Payloads must be serializable by the fork channel. A rejected action always answers with an error: whatever the handler threw is serialized, a falsy value included, so `null`, `false` or `0` thrown never arrive as a successful `undefined`. Messages that are not objects are ignored; an unknown response identifier is logged and ignored.

## Events

A subscription key is `origin|event`, which is why neither name may contain `|`. A child's first subscription to a key sends `ipc.event.subscribe` to the parent and its last release sends `ipc.event.unsubscribe`, which the parent applies: it forwards `ipc.event.dispatch` only for keys a child holds. The parent's own subscriptions are local. Listeners run synchronously when a message arrives; a listener that throws is logged and the others still run; returned promises are not awaited. There is no history, acknowledgement or replay: an event emitted before a subscription reached the parent is lost, and an application that cannot lose one arranges a handshake.

## Errors

`SerializableError.serialize(value)` produces `{ message, stack, cause? }`: an `Error` keeps its message, stack and cause chain, recursively; a string is its own message; any other value is its JSON when it has one, or its string form; a cause already on the chain is cut as `{ message: '[circular cause]', stack: '' }`. `deserialize` rebuilds plain `Error` instances with the chain and the stacks; names, codes, subclasses and other properties are not carried. `print` formats the chain with deduplicated stack headers.

## Lifecycle

Unregister a child before discarding it and stop it separately. `destroy()` in the parent settles every pending request of every child. The same fork registered under two names would receive duplicate routing; keep one identity per fork. Authorization is not implemented: any registered child may address any other and the parent, which is appropriate inside one application's process topology only.

## Consumers

The watchers utility registers its service child and routes create, delete and listener actions to it; its clients subscribe to `listener:<id>.change` events of the service origin. The Beyond compiler's own watchers wrapper uses the same handler.

## Build and validation

[beyond.json](../beyond.json) selects the package. The tests under [tests/](../tests/README.md) fork real children under the same loader; [validation](validation.md) maps each contract to its test and states what is not established.

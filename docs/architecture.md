# IPC actions, events and lifecycle

Beyond IPC coordinates Node parent/child processes over the IPC channel provided by child_process.fork. The main process names and registers children, executes local actions and routes requests/events between them. IPC does not fork processes, start services, authenticate network callers or reconnect them automatically.

## Public modules

[package.json](../package.json) selects the Beyond module root `modules`. All six manifests use TS bundles. The source package does not declare a plain Node root entrypoint or root npm scripts; it must be compiled/resolved through Beyond or consumed as built public modules.

| Public module | API |
| --- | --- |
| `@beyond-js/ipc/main` | [ipc singleton](../modules/main/index.ts) for main-process registration, actions and events |
| `@beyond-js/ipc/child` | [ipc singleton](../modules/child/index.ts) for a forked child |
| `@beyond-js/ipc/wrapper` | [ipc wrapper singleton](../modules/wrapper/index.ts), selects main/child asynchronously through global bimport |
| `@beyond-js/ipc/dispatcher` | [Dispatcher](../modules/dispatcher/index.ts), request/response correlation |
| `@beyond-js/ipc/errors` | [SerializableError and IErrorModel](../modules/errors/serializable.ts) |
| `@beyond-js/ipc/types` | [handler interfaces, request/response and event payload types](../modules/types/index.ts) |

MainProcessHandler and ChildProcessHandler are ordinary internal source exports, not marked public bundle constructors. Preserve the public singleton/module boundaries.

## Choosing a handler

Use main in the parent process and child in a fork with process.send. Importing child without an IPC channel warns, then Dispatcher construction fails. Importing main in a child warns but does not prohibit its construction. This is process.send detection, not a test for arbitrary worker threads or a network transport.

Wrapper creates a PendingPromise, tests process.send and calls global bimport for the selected module. exec awaits that promise; on/off/emit/handle/detach/register/unregister/destroy queue `.then` callbacks and return void. They provide no synchronous completion or awaitable failure. Failed bimport has no catch/reject settlement for the stored promise, leaving dependent calls pending. Modern BEE Node must explicitly supply the expected runtime import helper or use a deliberate integration; loader hooks alone do not define global bimport.

## Main and child API

| Method | Behavior |
| --- | --- |
| handle(action, callback) | Replace/set the local callback for that action. Callback receives spread positional parameters and may return a promise. |
| detach(action) | Remove a local action callback. There is no public `unhandle` method. |
| exec(target, action, ...params) | Execute locally for main→main, otherwise route and return a correlated promise. |
| on(origin, event, listener) | Register a callback for the exact origin/event pair. |
| off(origin, event, listener) | Remove that exact callback; retain callback identity. |
| emit(event, data) | Emit one data payload from the current process, with origin determined by routing. |
| notify(event, data) | Deprecated alias for emit. |
| register(name, fork), unregister(name) | Main only; name `main` is reserved. These do not start, kill or await a child. |
| destroy() | Remove some message handlers; incomplete resource/pending cleanup is described below. |

```ts
// Parent, with a compiled/resolvable public IPC module.
import { ipc } from '@beyond-js/ipc/main';
import { fork } from 'node:child_process';

const child = fork(childEntrypoint, [], childOptions);
ipc.register('worker', child);
ipc.handle('parent-value', () => 42);
// Establish application readiness before sending work.
const result = await ipc.exec('worker', 'sum', 2, 3);
```

```ts
// Child entrypoint, running with the parent's IPC channel.
import { ipc } from '@beyond-js/ipc/child';
ipc.handle('sum', (a, b) => a + b);
```

The application provides childEntrypoint/options and a readiness handshake. Registration only attaches routers; messages sent before a child's handler is installed are not queued until readiness. Unregister before discarding a child, separately stop it and await exit. Pending requests need explicit failure handling beyond the present package.

## Action flow and wire contract

A [Dispatcher](../modules/dispatcher/index.ts) binds to one ChildProcess in the main process or to process in a child. `exec` allocates a UUID and PendingPromise, records it, sends `{type: 'ipc.request', id, target, action, params}`, and returns the promise. A matching `{type: 'ipc.response', request, data, error}` resolves/rejects it and removes the entry. There is no container parameter despite older constructor comments describing one.

| Call | Route |
| --- | --- |
| main → main | MainProcessHandler.exec → local Actions.exec → handler; no serialization or Dispatcher |
| main → child | Main Actions router selects registered ChildRouter → its Dispatcher → child Actions handler → response back to that Dispatcher |
| child → main | Child Dispatcher → parent ChildRouter → parent Actions.exec → response to original child's request ID |
| child → child | Origin child's request reaches its parent ChildRouter; parent dispatches to target child with a **new** Dispatcher request ID, then responds to the origin with its original ID |

The [main action router](../modules/main/actions/router/index.ts) rejects unknown/duplicate child names. [ChildRouter](../modules/main/actions/router/child.ts) validates target/action presence, invokes the main or another child and serializes errors back. [Child actions](../modules/child/actions.ts) validates action/handler presence and awaits `handler(...params)`. Main registration installs action routing first, event routing second; it is not transactional if the latter fails.

Request values must be serializable by the fork channel's configured Node serialization. The package does not negotiate serializer versions, preserve arbitrary class instances or enforce a full schema. Several message checks use typeof object without excluding null; malformed null messages can throw. params is spread without array validation. Unknown response IDs are logged rather than silently accepted.

## Event subscriptions and ordering

The identity key is the concatenation `origin|event`. Callers should avoid the delimiter in names: no escaping or collision-resistant tuple encoding is implemented. Main emission uses origin `main`; child emission sends `{type: 'ipc.event.route', event, data}` to the parent, which supplies the registered child's name.

[Child Events](../modules/child/events.ts) stores callback Sets. The first local callback sends `ipc.event.subscribe`; removing the last sends `ipc.event.unsubscribe`. [Main event Router](../modules/main/events/router/index.ts) invokes matching main callbacks and asks each [OriginHandler](../modules/main/events/router/origin.ts) to forward only subscribed keys as `ipc.event.dispatch`. A child may subscribe to its own named origin; that event still traverses the parent.

Callbacks run synchronously when a message is delivered; synchronous exceptions are caught/logged per callback. Returned promises are not awaited, so asynchronous callback failures and ordering are application responsibilities. No event history, subscriber acknowledgement, replay, backpressure queue or cross-process transaction is implemented. Subscribe completion and later emission need an application handshake if lost startup events are unacceptable.

**Current unsubscribe defect:** parent OriginHandler handles `ipc.event.unsubscribe` by adding the key again instead of deleting it. The child removes local callbacks, but the parent continues forwarding messages, and the child can log messages without listeners. Full unregister removes the corresponding parent message handler; it is a separate operation from off.

## Error representation

SerializableError.serialize converts native Error into `{message, stack, cause?}` recursively. Non-Error throws become message strings using JSON serialization or String fallback and an empty stack. A string therefore becomes JSON-quoted text through serialize. deserialize reconstructs plain native Error objects with cause and restored stack; it does not preserve custom subclasses, names, codes or arbitrary properties. print formats an Error/cause chain and strips the first stack line to avoid a repeated header.

There is no toJSON method and **no cycle detection** for Error causes, despite older descriptions. Cyclic/deep cause chains can recurse indefinitely or overflow. Hostile getters/String conversion can still throw. Action response wrappers serialize only truthy errors; falsy throws such as null, false or zero can be sent as successful undefined data. Serializer support for non-Error values does not correct that wrapper condition. Main→main callbacks reject directly and bypass this wire conversion.

## Lifecycle and failure boundaries

- Dispatcher stores a pending request before send and does not wrap send with rejection/removal. A synchronous send failure can leak the entry; asynchronous send errors/backpressure are not handled with a send callback.
- No timeout, AbortSignal, retry or disconnect/exit rejection exists. A dead/nonresponsive child can leave exec unresolved indefinitely. Unregister and Dispatcher.destroy detach message listeners but do not reject/clear pending promises.
- MainProcessHandler.destroy destroys action routers only. It does not destroy event routing, whose class exposes no public destroy method. Main local event callbacks remain stored; unregister each child explicitly and remove callbacks while arranging process shutdown.
- Child destroy detaches its action/response/event message listeners, but event destroy does not send unsubscribe for all keys or clear callback Sets. Local handlers also remain in the discarded action object. No reusable restart state is defined.
- Duplicate names are rejected, but the same fork can be registered under multiple names, creating multiple message handlers; callers must ensure one intended identity per fork. Multiple IPC copies/singletons can also interpret each other's responses; UUID correlation avoids ordinary collisions but does not provide protocol-instance isolation.
- The event router derives origin from the registered fork, but action authorization is not implemented. A registered child can address other registered children and main handlers. Use this in an application-controlled process topology; network/session authorization belongs outside IPC.

Watchers is a concrete consumer: its parent registers a service fork; clients call create/delete/listener actions and subscribe to service-origin notifications. Finder consumes those notifications indirectly. File events, compiler invalidation and HMR remain separate layers; an IPC reply or event does not prove downstream rebuild completion.

## Build and verification

[beyond.json](../beyond.json) selects the package. Node/node-ts distributions use implementation bundle ports 1110/1111. Module tsconfig files use esnext and Node types. The [publish workflow](../.github/workflows/publish.yml) requests an npm distribution not declared by this manifest and installs floating Beyond; reconcile the release setup before relying on it. No root npm test/build script or runner configuration is supplied.

[IPC examples](../tests/test-ipc/test-ipc.js) fork children, use legacy BEE and print communication results with timed events. The [error example](../tests/test-errors-serialization/test-errors) prints a nested-cause round trip. They are not a complete assertion or cleanup suite and can leave children running. Do not treat a printed response as proof of teardown, timeout, unsubscription or modern loader compatibility.

Verification should cover all four action routes; unknown handlers/names; serialization of errors, falsy throws and cyclic causes; first/last event subscriptions; self events and delimiter collisions; delayed handler readiness; send failure; child exit with pending work; unregister/destroy and listener counts. Repair the lifecycle contracts while preserving the familiar Main/Child → Actions/Events → Router/Dispatcher structure.

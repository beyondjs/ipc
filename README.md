# @beyond-js/ipc

Route actions and origin-qualified events between a Node parent and the child processes it registers.

```ts
// Parent
import { ipc } from '@beyond-js/ipc/main';
import { fork } from 'node:child_process';

const child = fork(entry);                    // the application forks; IPC does not
ipc.register('worker', child);                // routes messages of that child under a name
ipc.handle('answer', () => 42);               // an action of the parent
const sum = await ipc.exec('worker', 'sum', 2, 3);
ipc.on('worker', 'progress', data => {});     // an event the child emits
ipc.unregister('worker');                     // rejects what the child still owed

// Child
import { ipc } from '@beyond-js/ipc/child';
ipc.handle('sum', (a, b) => a + b);
ipc.emit('progress', 0.5);
```

Public Beyond modules are **main**, **child**, **wrapper**, **dispatcher**, **errors** and **types**. [Architecture, APIs and lifecycle](docs/architecture.md) explains the four routes, the wire contract, event subscriptions, error serialization and teardown; [validation](docs/validation.md) maps each contract to its test with real child processes.

What a consumer relies on: a request to a child that exits, disconnects or is unregistered is rejected rather than left pending; a rejected action always rejects the caller, whatever was thrown, with an `Error` whose `cause` chain travels intact and a cyclic cause cut as `[circular cause]`; `off` releases a subscription in the parent as well as locally; `destroy()` releases every child and every local subscription. Registration does not create, start or await a child: readiness is the application's, and there is no request timeout by design.

This checkout is authored with Beyond: [beyond.json](beyond.json) selects [package.json](package.json), whose module root is `modules`. Compiled public modules and their dependencies must be available through a Beyond loader.

MIT; see [LICENSE](LICENSE).

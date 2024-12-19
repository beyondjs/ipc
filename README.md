# @beyond-js/ipc

`@beyond-js/ipc` provides a streamlined, bidirectional inter-process communication (IPC) layer between a Node.js main
process and its forked child processes. It allows you to:

-   Execute **actions** (request/response calls) across processes.
-   Subscribe to and emit **events** between processes.
-   Enable transparent **child-to-child (C2C)** communication via the main process acting as a router.

The package exposes a unified API regardless of whether your code runs in the main process or in a child process. When
you import `@beyond-js/ipc/main`, it automatically detects the environment and returns the appropriate IPC manager.

## Key Concepts

### Automatic Environment Detection

The single import `@beyond-js/ipc/main` determines if it’s running in the main process or a forked child process:

-   **Main Process:** Returns an IPC manager that can register multiple children, handle their actions, and route
    events.
-   **Child Process:** Returns an IPC manager that communicates directly with the main process. No additional setup
    needed.

### Actions: Request/Response Interactions

Actions let you call named functions defined in another process and await their result, making remote procedure calls
feel straightforward:

-   **Register Handlers:** In both main and child processes, define handlers (functions) associated with specific action
    names.
-   **Execute Actions:** From another process, trigger these named actions and await the returned response, just like
    calling a local function asynchronously.

For example, in the main process you might register actions that children can call, and in a child process, you might
define actions so the main process (or other children through the main) can request data or operations from it.

### Events: Publish/Subscribe Messaging

Events are asynchronous notifications broadcast to subscribed listeners:

-   **Subscriptions:** Processes can subscribe to events. In a child process, this subscription is routed through the
    main process.
-   **Emission:** Any process can emit events. The main process routes these events to all subscribed children.
    Similarly, when a child emits an event, the main process routes it to other interested children.

### Child-to-Child Communication (C2C)

C2C is enabled by the main process. When a child subscribes to events, the main process records these subscriptions. If
another child emits an event, the main process routes it accordingly, allowing children to communicate indirectly
without direct references to each other.

## Usage Overview

### Main Process

1. **Initialize:** Just `import ipc from '@beyond-js/ipc/main'`.
2. **Register Forked Processes:** Once child processes are forked, register them with `ipc.register(tag, fork)`.
3. **Action Handlers:** Use `ipc.handle('action-name', handler)` to define action handlers.
4. **Events:** Listen to events from children with `ipc.events.on('child-name', 'event-name', callback)` and emit events
   with `ipc.notify('event-name', data)`.

### Child Process

1. **Initialize:** Same import, `import ipc from '@beyond-js/ipc/main'`.
2. **Actions:** Implement actions by registering handlers with `ipc.handle('action-name', handler)`.
3. **Events:** Subscribe to events from main or other children with
   `ipc.events.on('some-process-tag', 'event-name', listener)` and emit local events with
   `ipc.notify('event-name', data)`.

## Version Compatibility

All processes must use compatible versions of `@beyond-js/ipc` to ensure that the communication protocol matches. If a
version mismatch occurs, `@beyond-js/ipc` will raise a `VersionError`.

## Example

**Main Process (main.js)**

```typescript
import { fork } from 'child_process';
import ipc from '@beyond-js/ipc/main';

// Fork a child process
const child = fork('child.js');

// Register the fork under a specific name (e.g., 'child-1')
// This name is used for executing actions and subscribing to events from that child
ipc.register('child-1', child);

// Listen to an event called 'child-ready' from the 'child-1' process
ipc.events.on('child-1', 'child-ready', data => {
	console.log('Main received "child-ready" event from child-1:', data);
});

// Execute an action named 'get-data' on 'child-1', and await its result
(async () => {
	const result = await ipc.exec('child-1', 'get-data', { someParam: 'example' });
	console.log('Action "get-data" returned from child-1:', result);
})();
```

**Child Process (child.js)**

```typescript
import ipc from '@beyond-js/ipc/main';

// Register an action handler for 'get-data'
ipc.handle('get-data', async params => {
	console.log('Child received "get-data" action request with params:', params);
	// Perform your logic here, e.g., fetch data, compute results
	return { message: 'Hello from the child process!', received: params };
});

// Notify the main process that this child is ready by emitting an event
ipc.notify('child-ready', { status: 'Child process is ready to work!' });
```

**What’s happening here?**

-   The **main process** forks a **child process**, registers it under a unique name (`child-1`), and then:

    -   Subscribes to events emitted by `child-1`.
    -   Executes an action (`get-data`) defined in `child-1`.

-   The **child process**:
    -   Defines a handler for the `get-data` action, allowing the main process to call it and get a result.
    -   Emits an event (`child-ready`) to inform the main process that it's ready, which the main process is listening
        for.

Through this setup, the main process can easily make requests to the child and respond to events it emits, and the child
process can similarly provide data and signal readiness events.

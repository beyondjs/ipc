# IPC Module

The IPC module enables structured communication between processes in a Node.js application, including:

-   Main process ↔ Child process communication (both directions).
-   Child ↔ Child communication, routed through the main process.

The **main process** is referred to as **"main"**, and it acts as the central coordinator for message routing. Child
processes communicate with each other and with the main process through a unified API, allowing:

-   Remote action execution (similar to RPC).
-   Event-based communication (publish-subscribe).

The system automatically handles message routing, ensuring that:

-   Child processes can send actions or events to other children (via the main process).
-   The main process can directly interact with any child.
-   Communication is asynchronous, with promise-based action resolution.

This module simplifies inter-process messaging and abstracts away the complexity of managing forks, message
serialization, and routing logic.

---

## Installation

```bash
npm install @beyond-js/ipc
```

⸻

## Usage

```ts
import { ipc } from '@beyond-js/ipc/main';
```

The imported ipc object automatically resolves to the correct handler depending on the process context: • In the main
process, ipc is an instance of MainProcessHandler. • In a child process, ipc is an instance of ChildProcessHandler.

⸻

## API

The IPC interface exposes a unified API for both main and child processes.  
The same methods are available in all contexts; behavior is handled internally based on the process type.

### Register a Child Process (main only)

```ts
const child = fork('./child.js');
ipc.register('child-a', child);
```

⸻

### Handle Actions

```ts
ipc.handle('get-time', () => new Date().toISOString());
```

### Execute Actions

```ts
const time = await ipc.exec('child-a', 'get-time');
```

### Emit and Subscribe to Events

```ts
ipc.on('child-a', 'status', data => {
	console.log('Status from child-a:', data);
});
ipc.emit('status', { ready: true });
```

### Unregister a Child

```ts
ipc.unregister('child-a');
```

### Remove Action Handlers

```ts
ipc.unhandle('get-time');
```

⸻

License

MIT

```

```

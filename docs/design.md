# @beyond-js/ipc: Developer Documentation

This document is intended for contributors and maintainers of the `@beyond-js/ipc` package. It provides an architectural
overview, explains the source code organization, and offers guidance on extending and maintaining the code.

## Overview

`@beyond-js/ipc` is a Node.js package that abstracts inter-process communication (IPC) between the main process and
multiple child processes. Its core features include:

-   **Actions:** Request/response calls that allow processes to invoke named handlers in other processes and await
    responses.
-   **Events:** Publish/subscribe messaging that enables processes to emit events and listen for them, including routing
    child-to-child events through the main process.

A key design decision is that the same import `@beyond-js/ipc/main` dynamically detects whether it is running in the
main process or a child process. Depending on the environment, it returns an appropriate IPC manager (main or child).

## Code Structure

```
@beyond-js/ipc/
├─ main/
│  ├─ index.ts
│  ├─ main/
│  │  ├─ actions/
│  │  │  ├─ index.ts
│  │  │  ├─ routers/
│  │  │  │  ├─ child.ts
│  │  │  │  └─ index.ts
│  │  ├─ events/
│  │  │  ├─ index.ts
│  │  │  ├─ routers/
│  │  │  │  ├─ child.ts
│  │  │  │  └─ index.ts
│  │  ├─ index.ts
│  ├─ dispatcher/
│  │  └─ index.ts
│  ├─ error.ts
│  ├─ interfaces/
│  │  ├─ index.ts
│  └─ child/
│     ├─ actions.ts
│     ├─ events.ts
│     └─ index.ts
```

### Main vs Child Code

-   **Main Process Code (`main/`)**  
    The `main/` directory contains code that runs in the main process. It manages:

    -   Multiple registered child processes.
    -   Routing actions and events between them.
    -   Handlers for main-level actions (if needed).
    -   Event subscriptions and routing for child-to-child communication.

-   **Child Process Code (`child/`)**  
    The `child/` directory is a bit of a naming convenience: it holds code that is loaded when we detect we are in a
    child process. It defines:
    -   How children handle incoming actions from the main process.
    -   How children emit and subscribe to events.
    -   A local dispatcher for actions executed by the child or requested to other processes through the main.

### Actions

**In the main process**, actions are handled by `main/actions/`:

-   `actions/index.ts`: Implements action registration, execution, and integration with routers.
-   `actions/routers/`: For child-to-child action routing. The main process uses these routers to direct action requests
    from one child to another.

**In the child process**, actions are handled by `child/actions.ts`:

-   This file sets up a message listener on the child’s `process.on('message', ...)`.
-   When it receives an action request, it looks up the corresponding handler and executes it, then sends back a
    response.

**Key Points:**

-   Actions internally follow a request/response pattern.
-   The main process or a child process can execute an action, and the target (main or another child via the main)
    responds with a result.

### Events

**In the main process**, events are managed by `main/events/`:

-   `events/index.ts`: Allows the main process to subscribe to events from children and to emit events to them.
-   `events/routers/`: Handles the routing of events between children (C2C).

**In the child process**, events are managed by `child/events.ts`:

-   Children can subscribe to events from other processes (via main) and emit events themselves.
-   Subscriptions in children inform the main process which events they are interested in, enabling the main to forward
    events accordingly.

**Key Points:**

-   Events are one-way messages (no response needed).
-   Main acts as a router for child-to-child events.
-   Subscriptions are declared at runtime. When a child subscribes, the main process keeps track to ensure routing is
    possible.

### Dispatcher

The `dispatcher/index.ts` files, present in both main and child contexts, encapsulate the logic of sending requests and
handling responses. For:

-   The main process: The dispatcher is used when the main wants to execute actions on a registered child.
-   The child process: The dispatcher is used when a child wants to execute actions on the main (or another child, via
    main).

It handles:

-   Generating unique request IDs.
-   Storing pending promises until a response arrives.
-   Sending serialized requests via `process.send()` and resolving/rejecting promises upon `process.on('message', ...)`.

### Error Handling and Version Checking

-   `error.ts` defines custom errors for IPC issues and version mismatches.
-   The `interfaces/index.ts` file exports `version` and message interface definitions.
-   Each incoming message checks `version`. If there is a mismatch, a `VersionError` is logged. This ensures all
    processes must be running compatible versions of `@beyond-js/ipc`.

### Lifecycle & Cleanup

Each class that adds event listeners to `process` or other objects provides a `destroy()` method to remove those
listeners.

-   When a child is unregistered, its associated listeners, dispatchers, and routers are cleaned up.
-   Similarly, `destroy()` in the child process removes event listeners from `process`.

This prevents memory leaks and ensures a clean shutdown.

## Development Guidelines

1. **TypeScript & Interfaces:**  
   Maintain strict typing. Keep the message interfaces and version checks in `interfaces/index.ts` accurate and up to
   date.

2. **Message Validation:**  
   Always validate incoming messages:

    - Confirm `type` matches a known IPC message type.
    - Check `version`.
    - Verify required fields (`id`, `action`, `event`) are present.

3. **Consistent Logging:**  
   Use `console.error`, `console.warn`, and `console.log` consistently. If the package grows, consider introducing a
   logging utility to standardize output.

4. **Testing:**  
   Write integration tests that spawn child processes and ensure actions and events flow correctly. Test version
   mismatches and error conditions.

5. **Extending the System:**
    - **New Features:** Keep the main and child abstractions symmetrical. Introduce new message types by defining new
      interfaces and adding logic in both `main` and `child` sections.
    - **Refactoring:** If complexity grows, consider moving repeated code (like message validation) into helper modules.

## Common Pitfalls

-   **Forgetting to Register a Child:**  
    The main must call `ipc.register(name, forkedProcess)` before that child can handle actions or events.
-   **Missing Action Handlers:**  
    If a process tries to `exec` an action that isn’t handled by the target, a descriptive error is returned.

-   **Unsubscribing from Events:**  
    Always ensure to call `off()` when listeners are no longer needed, or `destroy()` to clean up all listeners upon
    shutdown.

## Conclusion

`@beyond-js/ipc` is designed to provide a unified and elegant API for IPC in Node.js. By separating main and child
logic, abstracting message handling, and offering a consistent interface for actions and events, it aims to make complex
IPC interactions easier to manage and reason about.

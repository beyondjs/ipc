# Communication in `@beyond-js/ipc`

## Overview

The `@beyond-js/ipc` package facilitates seamless inter-process communication (IPC) between the main process and
multiple child processes in a Node.js environment. This document explains how the communication system works, detailing
the roles of key components such as the dispatcher, events, child-to-child communication, and routers.

---

## Key Components of the Communication System

### 1. Dispatcher

The **dispatcher** is responsible for managing request/response communication between processes. It encapsulates:

-   **Action Execution:**

    -   Generates unique request IDs for each action.
    -   Sends serialized requests to the target process via `process.send()`.
    -   Stores pending promises until a response is received.

-   **Response Handling:**
    -   Listens for messages via `process.on('message')`.
    -   Matches responses to their corresponding requests using request IDs.
    -   Resolves or rejects promises based on the response.

**Code References:**

-   **Main Process:** `main/dispatcher/index.ts`
-   **Child Process:** `main/child/actions.ts`

### 2. Events

Events enable publish/subscribe communication between processes. Unlike actions, events are one-way messages with no
response required.

-   **Event Subscription:**

    -   Child processes subscribe to events by notifying the main process.
    -   The main process keeps track of event subscriptions, including which child processes are interested in specific
        events.

-   **Event Emission:**
    -   Events are emitted by child processes or the main process.
    -   The main process routes events to all subscribed child processes.

**Code References:**

-   **Main Process:** `main/events/index.ts`
-   **Child Process:** `main/child/events.ts`

### 3. Child-to-Child (C2C) Communication

C2C communication allows one child process to communicate with another through the main process acting as a **router**.

-   **Subscription Management:**

    -   A child process informs the main process when it subscribes to or unsubscribes from an event.

-   **Routing Events:**
    -   When a child emits an event, the main process forwards it to all other subscribed children.

**Code References:**

-   Event routing logic is implemented in `main/events/routers/`.

### 4. Routers

Routers are central to directing both actions and events. They operate differently depending on whether the
communication involves:

-   **Action Requests:**

    -   Forwarded from the main process to the appropriate child process based on the request’s target.

-   **Event Emission:**
    -   Events emitted by one child are routed to other children subscribed to the same event.

**Code References:**

-   **Action Routers:** `main/actions/routers/`
-   **Event Routers:** `main/events/routers/`

---

## Communication Flow

### 1. Action Workflow

#### Main-to-Child Action

1. The main process sends an action request to a child using the dispatcher.
2. The child receives the request, executes the corresponding handler, and sends back a response.
3. The dispatcher in the main process resolves the pending promise with the response.

#### Child-to-Main Action

1. A child process sends an action request to the main process via its dispatcher.
2. The main process executes the requested handler and sends a response.
3. The child process resolves the promise with the response.

#### Child-to-Child Action

1. A child process sends an action request targeting another child.
2. The main process routes the request to the target child.
3. The target child executes the handler and sends a response back through the main process.

### 2. Event Workflow

#### Child-to-Main Event

1. A child process emits an event.
2. The main process receives the event and notifies all subscribed listeners.

#### Main-to-Child Event

1. The main process emits an event.
2. All subscribed child processes receive the event.

#### Child-to-Child Event

1. A child emits an event.
2. The main process routes the event to all other children subscribed to it.

---

## Error Handling

### Version Validation

Messages include a `version` field to ensure compatibility between processes. If a version mismatch is detected, a
`VersionError` is logged, and the message is discarded.

### Instance Validation

Messages include an `instance` field to ensure communication occurs within the correct IPC instance. Mismatched
instances result in ignored messages.

### Missing Handlers or Subscriptions

-   If an action handler is missing, the dispatcher logs a descriptive error.
-   If an event has no subscribers, the event is ignored without error.

---

## Example Use Case

### Scenario

A project with two child processes:

-   **Child A** subscribes to an event called `task.completed`.
-   **Child B** emits the `task.completed` event.

### Workflow

1. **Child A** subscribes to `task.completed` by informing the main process.
2. **Child B** emits the `task.completed` event.
3. The main process forwards the event to **Child A**, which executes its listener.

---

## Conclusion

The `@beyond-js/ipc` communication system combines flexibility and robustness, allowing complex interactions between the
main and child processes. By understanding the roles of dispatchers, events, routers, and child-to-child communication,
developers can build scalable, efficient IPC systems that handle even the most intricate use cases.

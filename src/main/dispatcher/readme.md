## Dispatcher

The `Dispatcher` is the central component responsible for sending and receiving messages between processes in the IPC
system. It supports executing remote actions and routing their responses through a unified, promise-based interface.

### Usage Contexts

The Dispatcher is used in two contexts:

-   **Main process** (`MainProcessHandler`):

    -   When `.exec(...)` is called, the dispatcher directly sends the message to the target child process.
    -   It uses a reference to the child (`fork: NodeJS.Process`) to communicate.

-   **Child process** (`ChildProcessHandler`):
    -   When `.exec(...)` is called, the dispatcher sends the request to the main process via `process.send`.
    -   The main process then acts as a **router**, forwarding the request to the correct target or handling it locally.
    -   The response is routed back through the same chain.

### Responsibilities

-   Assigns a unique ID to each outgoing action.
-   Sends the request message with action name and parameters.
-   Tracks pending actions and stores their corresponding promise resolvers.
-   Listens for responses and matches them by request ID.
-   Resolves or rejects the original promise when a response arrives.
-   Filters out unrelated messages using `ipc.instance` to avoid conflicts between multiple versions.

### Message Routing Logic

-   The Dispatcher abstracts the routing mechanism so callers can execute actions without knowing whether the target is
    in the same or a different process.
-   The main process acts as a **router**, forwarding messages as needed to reach the correct target.
-   All action results (success or failure) are returned back to the original caller.

### Multiple IPC Instances

To support multiple versions of the IPC package loaded in the same environment, each `Dispatcher` is tied to a unique
`instance` ID (`container.id`). This ensures that only messages intended for a specific IPC instance are handled,
preventing message leakage across versions.

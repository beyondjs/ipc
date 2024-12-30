# About Instances in `@beyond-js/ipc`

## Overview

One of the key considerations when working with the `@beyond-js/ipc` package is the potential for multiple versions of
the package to coexist within a single project. This situation arises due to project dependencies relying on different
versions of the IPC package. To address this, the module incorporates the concept of **instances** to isolate
communication contexts and ensure the proper functioning of actions and events.

This document explains the importance of instances, outlines where in the codebase they are implemented, and provides
guidelines for managing scenarios involving multiple IPC versions.

---

## Why Instances Are Necessary

### Potential for Version Mismatches

In complex Node.js projects, it is common for dependencies to require different versions of the same package. When this
happens with `@beyond-js/ipc`, multiple IPC modules may be loaded, each with its own version. Without isolation, this
can lead to:

-   **Cross-Instance Interference:** Actions and events meant for one version being incorrectly handled by another.
-   **Subscription Mismanagement:** Subscriptions from one version being overridden or ignored by another.

### Role of Instances

Each IPC manager (main or child) generates a unique instance identifier (UUID). This identifier ensures:

-   **Isolation:** Requests and responses are matched to the correct instance, avoiding interference between versions.
-   **Correct Routing:** Event subscriptions and action executions are isolated by instance, ensuring proper
    communication.
-   **Multi-Version Support:** The architecture supports multiple versions of `@beyond-js/ipc` running side by side.

The `instance` property within the IPC manager encapsulates this functionality. It is accessible in the IPC codebase and
plays a central role in tagging requests and responses for proper identification.

---

## Key Implementation Details

### Where to Find Instances in the Code

Instances are defined and utilized across the following files:

1. **Child Process Code**

    - **`main/child/index.ts`**

        - Generates the unique `#instance` identifier for the child process.
        - Provides the `instance` getter for referencing the instance ID.
        - Passes the instance ID in outgoing action requests and event subscriptions.

    - **`main/child/actions.ts`**

        - Embeds the instance ID into action requests (`IActionRequest`) sent to the main process.
        - Validates incoming responses by matching the instance ID.

    - **`main/child/events.ts`**

        - Includes the instance ID in event subscription (`IC2CSubscribe`) and unsubscription (`IC2CUnsubscribe`)
          messages sent to the main process.

2. **Main Process Code**

    - **`main/main/index.ts`**

        - Manages instances for all registered child processes.
        - Tracks subscriptions and routes events using instance-specific keys.
        - Exposes the `instance` property to identify the main process’s unique context.

    - **`main/dispatcher/index.ts`**

        - Validates instance IDs for incoming responses, ensuring they match the originating request’s instance.

3. **Shared Interfaces**

    - **`main/interfaces/index.ts`**
        - Defines the `ipc` object in `IActionRequest` and `IActionResponse` to include the instance ID.

### Instance Validation

The dispatcher and event routers validate instance IDs before processing messages. This ensures that only messages
originating from the same instance are handled, preserving communication integrity.

---

## Guidelines for Developers

### Be Aware of Multiple Versions

-   **Understand Dependencies:** Audit your project’s dependency tree to identify if multiple versions of
    `@beyond-js/ipc` are being installed.
-   **Test Scenarios:** Simulate environments with multiple versions to verify that instances are properly isolated.

### Treat Instances with Care

-   **Always Include the Instance ID:** Ensure all action requests and event subscriptions include the correct instance
    ID.
-   **Validate Incoming Messages:** Use the instance validation mechanisms provided in the codebase to avoid
    cross-instance interference.
-   **Debug with Instances in Mind:** When debugging communication issues, check if mismatched instance IDs are the
    cause.

### Example Use Case

#### Scenario

Your project uses two dependencies:

-   `libA` (requires `@beyond-js/ipc@1.0.0`)
-   `libB` (requires `@beyond-js/ipc@2.0.0`)

Both dependencies instantiate IPC managers. Without instance isolation, actions and events could conflict.

#### Solution

-   `libA` and `libB` each generate unique instance IDs.
-   All actions and subscriptions are tagged with the respective instance IDs.
-   The main process uses these IDs to route messages correctly, ensuring `libA` and `libB` operate independently.

---

## Common Pitfalls

1. **Forgetting to Include the Instance ID:**

    - If the instance ID is missing or incorrect, the main process cannot properly route messages.

2. **Assuming a Single Version:**

    - Avoid hardcoding assumptions about the presence of only one IPC instance in your project.

3. **Ignoring Version Errors:**

    - Always check for `VersionError` logs to detect and resolve compatibility issues.

---

## Conclusion

Instances are a cornerstone of the `@beyond-js/ipc` package’s ability to handle multi-version environments gracefully.
By understanding their purpose and leveraging the provided tools, developers can ensure robust and conflict-free
inter-process communication, even in the most complex dependency scenarios.

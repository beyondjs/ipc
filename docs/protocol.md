# Inter-Process Communication (IPC) Protocol Versions in `@beyond-js/ipc`

## Overview

The inter-process communication (IPC) mechanism in `@beyond-js/ipc` relies on a defined **protocol** to ensure that
messages exchanged between processes (main and child) are correctly interpreted. This protocol specifies the structure
and properties of the messages, encapsulated by the `version` property.

Currently, there is only **one version** of the IPC protocol. However, as the library evolves, multiple versions of the
protocol may coexist. This document explains the existing protocol, its interfaces, and how developers should handle
versioning in the future when different versions of the IPC package and protocol may coexist.

---

## The Current IPC Protocol

The current version of the IPC protocol is defined by the `version` property, located in the message interfaces. It
ensures that both the sender and receiver adhere to the same set of rules for interpreting messages. The protocol
governs:

1. **Message Structure:**

    - Each message must include required properties such as `type`, `id`, `action`, or `event`.
    - The `ipc` object contains metadata such as the `instance` and `version` properties.

2. **Validation:**

    - Each message includes the `version` property, which is compared against the expected version.
    - Mismatches result in errors, ensuring communication integrity.

3. **Supported Types:**
    - `ipc.action.request`: For sending action requests.
    - `ipc.action.response`: For sending responses to action requests.
    - `ipc.event`: For emitting events.
    - `ipc.c2c.event.subscribe` and `ipc.c2c.event.unsubscribe`: For managing child-to-child event subscriptions.

---

## Interfaces of the Current Protocol

The protocol's interfaces are defined in **`main/interfaces/index.ts`**. Key properties include:

### `IActionRequest`

Represents an action request sent by a process:

```typescript
export interface IActionRequest {
	version: typeof version; // Protocol version
	type: 'ipc.action.request';
	ipc: { instance: string }; // IPC instance metadata
	id: number; // Unique request ID
	target: string; // Target process
	action: string; // Action name
	params: any[]; // Action parameters
}
```

### `IActionResponse`

Represents a response to an action request:

```typescript
export interface IActionResponse {
	version: typeof version;
	type: 'ipc.action.response';
	ipc: { instance: string };
	request: { id: number }; // Original request ID
	response?: any; // Action result
	error?: Error | string; // Error details if any
}
```

### `IEvent`

Represents an event emitted by a process:

```typescript
export interface IEvent {
	version: typeof version;
	type: 'ipc.event';
	event: string; // Event name
	data: any; // Event data
}
```

---

## Preparing for Future Protocol Versions

### Coexistence of Multiple IPC Package Versions

In scenarios where multiple versions of the `@beyond-js/ipc` package are present, it is possible for:

1. Processes to run different **package versions**.
2. Processes to use different **protocol versions**, even if the package versions are compatible.

This necessitates robust handling of protocol versions to ensure seamless communication.

### Managing Protocol Versions

1. **Validate Protocol Versions:**

    - Every message should include the `version` property.
    - Compare the received version with the expected version.
    - If the versions differ, log a warning or raise a `VersionError`.

2. **Backward Compatibility:**

    - Ensure that newer versions of the protocol can handle messages from older versions when possible.
    - Use feature negotiation where needed (e.g., include a `features` property to specify supported capabilities).

3. **Graceful Degradation:**

    - If backward compatibility is not feasible, implement graceful degradation to avoid breaking communication.
    - For example, ignore unsupported message types or properties instead of throwing errors.

4. **Interface Evolution:**
    - When introducing new fields in message interfaces, ensure they are optional to maintain compatibility.
    - Clearly document deprecated fields and their removal timelines.

### Example of Protocol Version Handling

```typescript
process.on('message', (message: IActionRequest | IEvent) => {
	if (message.version !== version) {
		console.warn(
			`Received message with protocol version “${message.version}”, ` +
				`but expected version “${version}”. Message ignored.`
		);
		return;
	}

	// Proceed with message handling
	handleMessage(message);
});
```

### Version Negotiation Example

If a future protocol introduces optional features:

```typescript
export interface IActionRequest {
	version: typeof version;
	type: 'ipc.action.request';
	ipc: { instance: string; features?: string[] };
	id: number;
	target: string;
	action: string;
	params: any[];
}

// Check for supported features
if (message.ipc.features?.includes('new-feature')) {
	// Handle new feature
} else {
	// Fallback for older protocol versions
}
```

---

## Guidelines for Future Protocol Development

1. **Increment Version Numbers:**

    - Update the `version` property in `main/interfaces/index.ts` with each protocol change.

2. **Document Changes:**

    - Clearly document protocol changes, including added or removed fields and updated behaviors.

3. **Test Compatibility:**

    - Test interactions between processes using different protocol versions.

4. **Deprecation Policy:**
    - Maintain support for older protocol versions for a defined period.
    - Notify users when support for older versions will be dropped.

---

## Conclusion

The `version` property in the IPC protocol ensures communication consistency and compatibility. While today there is
only one version of the protocol, future developments may introduce new versions. By adhering to the guidelines
provided, developers can handle multiple protocol versions gracefully, ensuring reliable inter-process communication in
evolving and complex dependency environments.

export /*bundle*/ interface IErrorModel {
	message: string;
	stack: string;
	cause?: IErrorModel;
}

// Converts any value into a safe, human-readable string representation.

// - Strings are returned as-is.
// - Error instances return their message (or fallback to String(error)).
// - Other values are JSON-stringified when possible; if JSON.stringify fails
//   or returns undefined (e.g., for functions or symbols), String(value) is used instead.
// This ensures no exceptions are thrown during conversion.
function stringify(value: unknown): string {
	try {
		if (typeof value === 'string') return value;
		if (value instanceof Error) return value.message ?? String(value);
		const json = JSON.stringify(value);
		return json === undefined ? String(value) : json;
	} catch {
		return String(value);
	}
}

export /*bundle*/ class SerializableError {
	/**
	 * Serialize any error-like value into the wire format, preserving the cause chain.
	 */
	static serialize(error: unknown): IErrorModel {
		// Non-Error values become a leaf node with message and empty stack
		if (!(error instanceof Error)) {
			let message: string;
			try {
				const json = JSON.stringify(error);
				message = json === void 0 ? String(error) : json;
			} catch {
				message = String(error);
			}
			return { message, stack: '' };
		}

		const message = typeof error.message === 'string' ? error.message : '';
		const stack = typeof error.stack === 'string' ? error.stack : '';
		const out: IErrorModel = { message, stack };

		const cause = (error as Error).cause;
		if (cause !== void 0) {
			// Recursively serialize nested Error causes
			out.cause = SerializableError.serialize(cause);
		}

		return out;
	}

	/**
	 * Rebuild a native Error (with nested causes) from the wire format.
	 */
	static deserialize(model: IErrorModel): Error {
		const nested = model.cause ? SerializableError.deserialize(model.cause) : undefined;
		const error = new Error(model.message, { cause: nested });
		try {
			error.stack = model.stack;
		} catch {}
		return error;
	}

	/**
	 * Return a formatted string for the error and its full cause chain.
	 * It shows "Name: message" and the stack (deduplicated) for each level.
	 */
	static print(error: unknown, depth = 0): string {
		const pad = ' '.repeat(depth * 2);

		// Non-Error branch
		if (!(error instanceof Error)) {
			return `${pad}↳ ${stringify(error)}`;
		}

		// Header line
		const head = `${pad}${error.name}: ${error.message}`;

		// Stack (remove duplicated first line if present)
		const trace = typeof error.stack === 'string' ? error.stack : '';
		let body = '';
		if (trace) {
			const lines = trace.split('\n');
			const rest = lines
				.slice(1)
				.map(l => `${pad}${l}`)
				.join('\n');
			body = rest ? `\n${rest}` : '';
		}

		// Cause chain
		const cause = (error as any).cause;
		const tail = cause !== undefined ? `\n${SerializableError.print(cause, depth + 1)}` : '';

		return head + body + tail;
	}
}

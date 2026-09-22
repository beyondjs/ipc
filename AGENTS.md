# ipc agent instructions

Canonical instructions for this independent repository and its descendants. Read the local README and relevant guides before changing code. This utility is authored with Beyond and must preserve its public package and module boundaries.

Keep the contracts the tests establish: a rejected action always answers with a serialized error, whatever was thrown; a request to a child that exits, disconnects or is unregistered is rejected, and `destroy()` rejects every pending request; `off` releases a subscription in the parent; error cause chains travel and a cycle is cut, never followed. A request timeout is a compatibility decision that does not exist. [Validation](docs/validation.md) maps each contract to its test; run the tests after a change.

- Preserve the selected branch, existing changes and public identifiers. Do not commit, push, reset, deploy or publish without explicit authorization.
- Use English for first-party documentation, comments and explanatory text. Preserve functional strings and generated/vendor content.
- Keep documentation autonomous: relative links stay inside this repository; external packages are described as contracts with optional references.
- Preserve the existing module/object programming structure. Internal files are not automatically public modules. Keep bare public imports intact.
- Distinguish source behavior, known defects, proposed changes and executed validation. Documentation work does not authorize implementation changes, dependency installations or service startup.
- Validate links, anchors and formatting for documentation edits. Run tests appropriate to actual code changes only.
- Follow the [coding standards](docs/coding-standards.md); they are binding for new and modified code. Source files target 300 lines or fewer and must not exceed 400. Model each responsibility as a class that owns `#private` state and exposes simply named members, composed from collaborating objects. Avoid compound names in methods, properties, variables and parameters by giving the responsibility its own object: `client.register()`, not `registerClient()`. Compound names remain allowed in class definitions. Preserve public contracts, and do not rewrite untouched files only to comply.

Documentation follows [the local documentation standards](docs/AGENTS.md).

The coordinated working branch is `feature/next`. Its base preserves the selected TypeScript implementation; do not switch back to historical source branches for ordinary work.

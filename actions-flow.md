# Action Execution Flow

This document describes the method-by-method execution flow for action handling in the IPC system, detailing how each
case is routed, executed, and resolved across processes.

---

## 1. main → main

### Sequence

1. `ipc.exec(target: 'main', action, ...params)`  
   File: `main/index.ts`  
   Class: `MainProcessHandler`  
   Method: `exec(target, action, ...params)`

2. Calls `this.actions.exec(action, ...params)`  
   File: `actions/index.ts`  
   Class: `Actions` (property of `MainProcessHandler`)  
   Method: `exec(action, ...params)`

3. Retrieves the handler from `this.#handlers.get(action)`  
   File: `actions/index.ts`  
   Private property: `#handlers`

4. Executes the handler: `handler(...params)`

5. Returns the response to the caller of `ipc.exec(...)`

---

## 2. main → child

### Sequence

1. `ipc.exec(target: 'childA', action, ...params)`  
   File: `main/index.ts`  
   Class: `MainProcessHandler`  
   Method: `exec(target, action, ...params)`

2. Calls `this.actions.dispatch(target, action, ...params)`  
   File: `actions/index.ts`  
   Class: `Actions`  
   Method: `dispatch(...)`

3. Calls `router.dispatch(target, action, ...params)`  
   File: `actions/router/index.ts`  
   Class: `Router`

4. Calls `child.dispatch(action, ...params)`  
   File: `actions/router/child.ts`  
   Class: `ChildRouter`

5. Calls `dispatcher.exec(name, action, ...params)`  
   File: `dispatcher.ts`  
   Class: `Dispatcher`

6. Sends message to child via `fork.send(...)`

7. Child receives message, executes the action, and sends a response.

8. The promise is resolved in `dispatcher.exec(...)` in the main process.

---

## 3. child → main

### Sequence

1. `ipc.exec(target: 'main', action, ...params)`  
   File: `child/index.ts`  
   Class: `ChildProcessHandler`  
   Method: `exec(target, action, ...params)`

2. Calls `this.dispatcher.exec('main', action, ...params)`  
   File: `dispatcher.ts`  
   Class: `Dispatcher`

3. Sends message to main via `process.send(...)`

4. Main receives message in `ChildRouter.#onmessage(message)`  
   File: `actions/router/child.ts`  
   Class: `ChildRouter`

5. Calls `#exec(message)` in `ChildRouter`

6. Calls `this.#main.actions.exec(action, ...params)`  
   File: `actions/index.ts`  
   Class: `Actions`

7. Retrieves the handler from `this.#handlers.get(action)`  
   Executes handler and returns result.

8. Sends response to child via `fork.send(...)`

9. Child receives response and resolves the promise in `dispatcher.exec(...)`

---

## 4. child → child

### 4.1 child → self (same process)

1. `ipc.exec(target: 'self', action, ...params)`  
   File: `child/index.ts` → `dispatcher.ts`

2. Sends message to main via `process.send(...)`

3. Main receives message in `ChildRouter.#onmessage(message)`  
   Detects that the target is the same child.

4. Forwards message back to the same child via `fork.send(...)`

5. Child executes the action and sends a response.

6. Promise is resolved in `dispatcher.exec(...)` in the same child.

---

### 4.2 child → child (different processes)

1. `ipc.exec(target: 'childB', action, ...params)`  
   File: `child/index.ts` → `dispatcher.ts`

2. Sends message to main via `process.send(...)`

3. Main receives message in `ChildRouter.#onmessage(message)`  
   Calls `#exec(message)`

4. Calls `this.#main.actions.dispatch(target, action, ...params)`  
   File: `actions/index.ts`  
   Class: `Actions`

5. Calls `router.dispatch(target, action, ...params)`  
   Calls `childB.dispatch(action, ...params)`  
   File: `actions/router/child.ts`

6. Uses `dispatcher.exec(...)` → sends message to childB via `fork.send(...)`

7. ChildB executes the action and sends response to main.

8. Main forwards response to childA.

9. ChildA receives response and resolves the promise in `dispatcher.exec(...)`

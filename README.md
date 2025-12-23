# use-server-action

A type-safe React hook and utilities for working with Next.js server actions.

## Installation

```bash
npm install use-server-action
```

## Quick Start

### 1. Create a server action

```ts
// app/actions.ts
"use server";

import { serverAction, success, error } from "use-server-action";

export const createUser = serverAction(async (name: string) => {
    if (!name.trim()) {
        throw new Error("Name is required");
    }

    const user = await db.user.create({ data: { name } });
    return user;
});

// Or handle errors manually for more control:
export const deleteUser = async (id: string) => {
    try {
        await db.user.delete({ where: { id } });
        return success({ deleted: true });
    } catch (e) {
        return error("Failed to delete user", "DELETE_FAILED");
    }
};
```

### 2. Use in a client component

```tsx
"use client";

import { useServerAction } from "use-server-action";
import { createUser } from "./actions";

export function CreateUserForm() {
    const {
        execute,
        data,
        error,
        isPending,
        isSuccess,
        isError,
        reset,
    } = useServerAction({
        action: createUser,
        onSuccess: (user) => {
            console.log("User created:", user);
        },
        onError: (message, code) => {
            console.error(`Error [${code}]:`, message);
        },
    });

    return (
        <form action={(formData) => execute(formData.get("name") as string)}>
            <input name="name" placeholder="Name" disabled={isPending} />
            <button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create User"}
            </button>
            {isError && <p className="error">{error}</p>}
            {isSuccess && <p className="success">Created: {data?.name}</p>}
        </form>
    );
}
```

## API Reference

### `useServerAction(options)`

A React hook for executing server actions with loading, error, and success states.

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `action` | `(...args) => Promise<ServerActionResult<T>>` | The server action to execute |
| `onSuccess` | `(data: T) => void` | Called when the action succeeds |
| `onError` | `(message: string, code?: string) => void` | Called when the action fails |
| `onSettled` | `() => void` | Called when the action completes (success or error) |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `execute` | `(...args) => void` | Execute the action (wrapped in React transition) |
| `executeAsync` | `(...args) => Promise<ServerActionResult<T>>` | Execute and return the result directly |
| `data` | `T \| null` | Data from the last successful execution |
| `error` | `string \| null` | Error message from the last failed execution |
| `errorCode` | `string \| null` | Error code from the last failed execution |
| `isPending` | `boolean` | Whether the action is currently executing |
| `isSuccess` | `boolean` | Whether the last execution succeeded |
| `isError` | `boolean` | Whether the last execution failed |
| `reset` | `() => void` | Reset all state to initial values |

### `serverAction(fn, options?)`

Wraps an async function to return a standardized `ServerActionResult`. Automatically catches errors.

```ts
import { serverAction } from "use-server-action";

export const myAction = serverAction(async (input: string) => {
    // Your logic here - just throw errors normally
    if (!input) throw new Error("Input required");
    return { result: input.toUpperCase() };
});
```

### `success(data)` / `error(message, code?)`

Helper functions to create result objects manually:

```ts
import { success, error } from "use-server-action";

export async function myAction(id: string) {
    const item = await db.find(id);

    if (!item) {
        return error("Item not found", "NOT_FOUND");
    }

    return success(item);
}
```

### Type Guards

```ts
import { isSuccess, isError, unwrap, unwrapOr } from "use-server-action";

const result = await myAction("123");

if (isSuccess(result)) {
    console.log(result.data); // Type-safe access
}

if (isError(result)) {
    console.log(result.message, result.code);
}

// Unwrap or throw
const data = unwrap(result);

// Unwrap with default
const data = unwrapOr(result, defaultValue);
```

## Types

```ts
type ServerActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; message: string; code?: string };
```

## License

MIT

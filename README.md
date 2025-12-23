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

import { serverAction, success, error } from "use-server-action/server";

export const createUser = serverAction(async (name: string) => {
    if (!name.trim()) {
        throw new Error("Name is required");
    }

    const user = await db.user.create({ data: { name } });
    return user;
});

// Or handle errors manually for more control:
export const deleteUserAction = async (id: string) => {
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

## Documentation

You can view the documentation [here](https://use-server-action.jackh.sh)

## License

MIT

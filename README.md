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

import { createAction, createContextMiddleware } from "use-server-action/server";

// Simple action
export const createUser = createAction<{ name: string }>()
    .handle(async (ctx, input) => {
        const user = await db.user.create({ data: { name: input.name } });
        return { ok: true, data: user };
    });

// With authentication middleware
const withAuth = createContextMiddleware(async (next, ctx, ...args) => {
    const user = await getUser();
    if (!user) {
        return { ok: false, message: "Unauthorized", code: "UNAUTHORIZED" };
    }
    return next({ ...ctx, user }, ...args);
});

export const deleteUser = createAction<{ id: string }>()
    .use(withAuth)
    .handle(async (ctx, input) => {
        await db.user.delete({ where: { id: input.id, ownerId: ctx.user.id } });
        return { ok: true, data: { deleted: true } };
    });
```

### 2. Use in a client component

```tsx
"use client";

import { useServerAction } from "use-server-action";
import { createUser } from "./actions";

export function CreateUserForm() {
    const { execute, data, error, isPending, isSuccess, isError } = useServerAction({
        action: createUser,
        onSuccess: (user) => console.log("User created:", user),
        onError: (message, code) => console.error(`Error [${code}]:`, message),
    });

    return (
        <form action={(formData) => execute({ name: formData.get("name") as string })}>
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

## Features

- **Type-safe** - Full TypeScript support with inferred types for context and inputs
- **Middleware support** - Chain middleware with `createAction().use(middleware)`
- **Context accumulation** - Middleware can add typed context for downstream handlers
- **Automatic error handling** - Thrown errors are caught and returned as error results
- **Zod validation** - Built-in `withZodValidation` middleware for input validation

## Documentation

You can view the documentation [here](https://use-server-action.jackh.sh)

## License

MIT

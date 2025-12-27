"use server";

import type { ServerActionResult } from "./server-action";
import type {
    BaseContext,
    ContextMiddleware,
    Middleware,
} from "./types";
import { isContextMiddleware } from "./context-middleware";

/**
 * A builder for creating server actions with type-safe context accumulation.
 *
 * @template TInput - The input parameters as a tuple type
 * @template TContext - The accumulated context type from all middleware
 */
class ActionBuilder<
    TInput extends unknown[] = unknown[],
    TContext extends BaseContext = {},
> {
    private middlewares: Array<
        ContextMiddleware<any, any, any, any> | Middleware<any, any>
    > = [];

    private constructor(
        middlewares: Array<
            ContextMiddleware<any, any, any, any> | Middleware<any, any>
        > = [],
    ) {
        this.middlewares = middlewares;
    }

    /**
     * Create a new ActionBuilder instance
     */
    static create<TInput extends unknown[]>(): ActionBuilder<TInput, {}> {
        return new ActionBuilder<TInput, {}>();
    }

    /**
     * Add a context-aware middleware to the chain.
     * The middleware receives the accumulated context and can add new context.
     *
     * @example
     * ```ts
     * const withUser = createContextMiddleware(async (next, ctx, ...args) => {
     *     const user = await getUser();
     *     if (!user) {
     *         return { ok: false, message: "Unauthorized", code: "UNAUTHORIZED" };
     *     }
     *     return next({ ...ctx, user }, ...args);
     * });
     *
     * const action = createAction<[{ name: string }]>()
     *     .use(withUser)
     *     .handle(async (ctx, input) => {
     *         // ctx.user is fully typed!
     *     });
     * ```
     */
    use<CtxOut extends BaseContext>(
        middleware: ContextMiddleware<TInput, any, TContext, CtxOut>,
    ): ActionBuilder<TInput, TContext & CtxOut>;

    /**
     * Add a regular (non-context) middleware to the chain.
     * The middleware can transform input/output but doesn't modify context.
     *
     * @example
     * ```ts
     * const withLogging = createMiddleware(async (next, ...args) => {
     *     console.log("Args:", args);
     *     const result = await next(...args);
     *     console.log("Result:", result);
     *     return result;
     * });
     *
     * const action = createAction<[string]>()
     *     .use(withLogging)
     *     .handle(async (ctx, input) => { ... });
     * ```
     */
    use(middleware: Middleware<TInput, any>): ActionBuilder<TInput, TContext>;

    use(middleware: any): any {
        return new ActionBuilder<TInput, TContext>([
            ...this.middlewares,
            middleware,
        ]);
    }

    /**
     * Define the action handler. This finalizes the builder and returns the executable action.
     * The handler receives the accumulated context and input parameters.
     *
     * @example
     * ```ts
     * const action = createAction<[{ name: string; email: string }]>()
     *     .use(withUser)
     *     .handle(async (ctx, input) => {
     *         // ctx and input are fully typed
     *         return { ok: true, data: result };
     *     });
     *
     * // Call the action
     * const result = await action({ name: "John", email: "john@example.com" });
     * ```
     */
    handle<TOutput>(
        handler: (
            ctx: TContext,
            ...args: TInput
        ) => Promise<ServerActionResult<TOutput>>,
    ): (...args: TInput) => Promise<ServerActionResult<TOutput>> {
        const middlewares = [...this.middlewares];

        return async (...args: TInput): Promise<ServerActionResult<TOutput>> => {
            // Build the middleware chain
            type CtxNextFn = (
                ctx: BaseContext,
                ...args: TInput
            ) => Promise<ServerActionResult<TOutput>>;

            const finalHandler: CtxNextFn = async (ctx, ...a) => {
                return handler(ctx as TContext, ...a);
            };

            // Build chain from right to left (last middleware wraps closest to handler)
            const chain = middlewares.reduceRight<CtxNextFn>((next, mw) => {
                if (isContextMiddleware(mw)) {
                    // Context middleware: (next, ctx, ...params) => ...
                    return async (ctx, ...a) => {
                        return (mw as ContextMiddleware<TInput, TOutput, any, any>)(
                            async (newCtx, ...params) => next(newCtx, ...(params as TInput)),
                            ctx,
                            ...a,
                        );
                    };
                } else {
                    // Regular middleware: (next, ...params) => ...
                    // Pass context through unchanged
                    return async (ctx, ...a) => {
                        return (mw as Middleware<TInput, TOutput>)(
                            async (...params) => next(ctx, ...(params as TInput)),
                            ...a,
                        );
                    };
                }
            }, finalHandler);

            // Start with empty context
            return chain({}, ...args);
        };
    }
}

/**
 * Converts a type to a tuple of arguments.
 * - `void` becomes `[]` (no args)
 * - Single type `T` becomes `[T]`
 * - Tuple type `[A, B]` stays as `[A, B]`
 */
type ToArgs<T> = [T] extends [void] ? [] : T extends unknown[] ? T : [T];

/**
 * Creates a new action builder with type-safe context accumulation.
 *
 * @example
 * ```ts
 * // Single input parameter
 * const createUser = createAction<{ name: string; email: string }>()
 *     .use(withUser)
 *     .handle(async (ctx, input) => {
 *         await db.users.create({ ...input, createdBy: ctx.user.id });
 *         return { ok: true, data: { success: true } };
 *     });
 *
 * // Multiple input parameters (use tuple)
 * const updateUser = createAction<[string, { name: string }]>()
 *     .use(withUser)
 *     .handle(async (ctx, id, data) => {
 *         await db.users.update(id, data);
 *         return { ok: true, data: { success: true } };
 *     });
 *
 * // With validation middleware
 * const createPost = createAction<z.infer<typeof postSchema>>()
 *     .use(withZodValidation(postSchema))
 *     .use(withUser)
 *     .handle(async (ctx, input) => {
 *         return { ok: true, data: await db.posts.create(input) };
 *     });
 * ```
 */
export function createAction<TInput = void>(): ActionBuilder<ToArgs<TInput>, {}> {
    return ActionBuilder.create<ToArgs<TInput>>();
}

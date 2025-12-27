"use server";

import type { ServerActionResult } from "./server-action";

/**
 * A middleware function that wraps a server action.
 * Receives the next function in the chain and the parameters passed to the action.
 */
export type Middleware<P extends unknown[], T> = (
    next: (...params: P) => Promise<ServerActionResult<T>>,
    ...params: P
) => Promise<ServerActionResult<T>>;

// ============================================================================
// Context-Aware Middleware Types
// ============================================================================

/**
 * Base context type - all contexts extend from this
 */
export type BaseContext = Record<string, unknown>;

/**
 * A context-aware middleware that can receive context from previous middleware
 * and add new context for downstream middleware.
 *
 * @template P - The parameter types for the action
 * @template T - The return type of the action
 * @template CtxIn - The context type this middleware expects to receive
 * @template CtxOut - The context type this middleware adds (merged with CtxIn for next)
 */
export type ContextMiddleware<
    P extends unknown[],
    T,
    CtxIn extends BaseContext = BaseContext,
    CtxOut extends BaseContext = BaseContext,
> = (
    next: (ctx: CtxIn & CtxOut, ...params: P) => Promise<ServerActionResult<T>>,
    ctx: CtxIn,
    ...params: P
) => Promise<ServerActionResult<T>>;

/**
 * Creates a type-safe middleware function.
 *
 * @example
 * ```ts
 * const withLogging = createMiddleware(async (next, ...params) => {
 *     console.log("Calling action with:", params);
 *     const result = await next(...params);
 *     console.log("Result:", result);
 *     return result;
 * });
 * ```
 */
export function createMiddleware<P extends unknown[], T>(
    handler: Middleware<P, T>,
): Middleware<P, T> {
    return handler;
}

/**
 * Applies middleware to a server action.
 * Middleware is executed in order (first middleware wraps second, etc).
 *
 * @example
 * ```ts
 * const protectedAction = applyMiddleware(
 *     myServerAction,
 *     [withAuth, withLogging, withValidation]
 * );
 * ```
 */
export function applyMiddleware<P extends unknown[], T>(
    action: (...params: P) => Promise<ServerActionResult<T>>,
    middleware: Middleware<P, T>[],
): (...params: P) => Promise<ServerActionResult<T>> {
    return middleware.reduceRight(
        (next, mw) =>
            (...params: P) =>
                mw(next, ...params),
        action,
    );
}

/**
 * Composes multiple middleware into a single middleware.
 *
 * @example
 * ```ts
 * const combined = composeMiddleware(withAuth, withLogging, withValidation);
 * const protectedAction = applyMiddleware(myAction, [combined]);
 * ```
 */
export function composeMiddleware<P extends unknown[], T>(
    ...middleware: Middleware<P, T>[]
): Middleware<P, T> {
    return (next, ...params) => {
        const chain = middleware.reduceRight(
            (nextFn, mw) =>
                (...p: P) =>
                    mw(nextFn, ...p),
            next,
        );
        return chain(...params);
    };
}

// ============================================================================
// Context-Aware Action Builder
// ============================================================================

/**
 * A builder for creating server actions with type-safe context accumulation.
 * Middleware can add to the context, and subsequent middleware receives the accumulated context.
 *
 * @template P - The parameter types for the action
 * @template T - The return type of the action
 * @template Ctx - The accumulated context type from all middleware
 */
class ActionBuilder<P extends unknown[], T, Ctx extends BaseContext = BaseContext> {
    private middlewares: ContextMiddleware<P, T, BaseContext, BaseContext>[] = [];
    private actionFn: (ctx: Ctx, ...params: P) => Promise<ServerActionResult<T>>;

    constructor(action: (ctx: Ctx, ...params: P) => Promise<ServerActionResult<T>>) {
        this.actionFn = action;
    }

    /**
     * Add a context-aware middleware to the chain.
     * The middleware receives the accumulated context and can add new context.
     *
     * @example
     * ```ts
     * const action = createAction(async (ctx, input: string) => {
     *     // ctx has { user: User, db: Database }
     *     return { ok: true, data: await ctx.db.query(input) };
     * })
     *     .use(withAuth)  // adds { user: User }
     *     .use(withDb)    // adds { db: Database }
     *     .build();
     * ```
     */
    use<CtxOut extends BaseContext>(
        middleware: ContextMiddleware<P, T, Ctx, CtxOut>,
    ): ActionBuilder<P, T, Ctx & CtxOut> {
        this.middlewares.push(
            middleware as unknown as ContextMiddleware<P, T, BaseContext, BaseContext>,
        );
        return this as unknown as ActionBuilder<P, T, Ctx & CtxOut>;
    }

    /**
     * Build the final server action with all middleware applied.
     * Returns a function that accepts only the parameters (context is handled internally).
     */
    build(): (...params: P) => Promise<ServerActionResult<T>> {
        const middlewares = this.middlewares;
        const action = this.actionFn;

        return async (...params: P): Promise<ServerActionResult<T>> => {
            // Build the chain from right to left (last middleware is closest to action)
            type NextFn = (ctx: BaseContext, ...p: P) => Promise<ServerActionResult<T>>;

            const finalAction: NextFn = async (ctx, ...p) => {
                return action(ctx as Ctx, ...p);
            };

            const chain = middlewares.reduceRight<NextFn>((next, mw) => {
                return async (ctx, ...p) => {
                    return mw(
                        async (newCtx, ...nextParams) => {
                            return next(newCtx, ...nextParams);
                        },
                        ctx,
                        ...p,
                    );
                };
            }, finalAction);

            // Start with empty context
            return chain({}, ...params);
        };
    }
}

/**
 * Creates a new action builder with type-safe context accumulation.
 *
 * @example
 * ```ts
 * type User = { id: string; name: string };
 *
 * // Create middleware that adds user to context
 * const withAuth = createContextMiddleware<[string], User, {}, { user: User }>(
 *     async (next, ctx, input) => {
 *         const user = await getUser();
 *         if (!user) {
 *             return { ok: false, message: "Unauthorized", code: "UNAUTHORIZED" };
 *         }
 *         return next({ ...ctx, user }, input);
 *     }
 * );
 *
 * // Create the action with middleware
 * const myAction = createAction<[string], User, { user: User }>(
 *     async (ctx, input) => {
 *         // ctx.user is fully typed!
 *         return { ok: true, data: ctx.user };
 *     }
 * )
 *     .use(withAuth)
 *     .build();
 *
 * // Call the action (context is handled internally)
 * const result = await myAction("some-input");
 * ```
 */
export function createAction<P extends unknown[], T, Ctx extends BaseContext = BaseContext>(
    action: (ctx: Ctx, ...params: P) => Promise<ServerActionResult<T>>,
): ActionBuilder<P, T, Ctx> {
    return new ActionBuilder(action);
}

/**
 * Creates a type-safe context-aware middleware.
 *
 * @example
 * ```ts
 * type User = { id: string; name: string };
 *
 * const withAuth = createContextMiddleware<
 *     [string],           // Parameters
 *     SomeReturnType,     // Return type
 *     {},                 // Input context (none required)
 *     { user: User }      // Output context (adds user)
 * >(async (next, ctx, input) => {
 *     const user = await authenticate();
 *     if (!user) {
 *         return { ok: false, message: "Unauthorized", code: "UNAUTHORIZED" };
 *     }
 *     // Pass the new context with user added
 *     return next({ ...ctx, user }, input);
 * });
 * ```
 */
export function createContextMiddleware<
    P extends unknown[],
    T,
    CtxIn extends BaseContext = BaseContext,
    CtxOut extends BaseContext = BaseContext,
>(
    handler: ContextMiddleware<P, T, CtxIn, CtxOut>,
): ContextMiddleware<P, T, CtxIn, CtxOut> {
    return handler;
}

/**
 * A Zod-like schema interface for validation.
 * Works with Zod, Valibot, or any schema library with a compatible safeParse method.
 */
export type ValidationSchema<T> = {
    safeParse(
        data: unknown,
    ):
        | { success: true; data: T }
        | {
              success: false;
              error: { message?: string; errors?: Array<{ message: string }> };
          };
};

export type WithValidationOptions = {
    /** Error code to return on validation failure. Defaults to "VALIDATION_ERROR" */
    code?: string;
    /** Custom error message formatter */
    formatError?: (error: {
        message?: string;
        errors?: Array<{ message: string }>;
    }) => string;
};

/**
 * Creates a middleware that validates the first parameter against a schema.
 * Works with Zod, Valibot, or any library with a compatible safeParse method.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { withValidation, applyMiddleware } from "use-server-action/server";
 *
 * const CreateUserSchema = z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 * });
 *
 * const createUser = applyMiddleware(
 *     serverAction(async (input: z.infer<typeof CreateUserSchema>) => {
 *         return await db.user.create({ data: input });
 *     }),
 *     [withValidation(CreateUserSchema)]
 * );
 * ```
 */
export function withZodValidation<TInput, T>(
    schema: ValidationSchema<TInput>,
    options: WithValidationOptions = {},
): Middleware<[TInput], T> {
    const { code = "VALIDATION_ERROR", formatError } = options;

    return async (next, input) => {
        const result = schema.safeParse(input);

        if (!result.success) {
            const message = formatError
                ? formatError(result.error)
                : (result.error.errors?.[0]?.message ??
                  result.error.message ??
                  "Validation failed");

            return { ok: false, message, code };
        }

        return next(result.data);
    };
}

/**
 * Creates a middleware that logs action calls and results.
 */
export function withLogging<P extends unknown[], T>(
    logger: {
        onCall?: (params: P) => void;
        onSuccess?: (data: T, params: P) => void;
        onError?: (
            message: string,
            code: string | undefined,
            params: P,
        ) => void;
    } = {},
): Middleware<P, T> {
    return async (next, ...params) => {
        logger.onCall?.(params);
        const result = await next(...params);
        if (result.ok) {
            logger.onSuccess?.(result.data, params);
        } else {
            logger.onError?.(result.message, result.code, params);
        }
        return result;
    };
}

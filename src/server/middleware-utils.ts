"use server";

import type { ServerActionResult } from "./server-action";
import type { Middleware, ValidationSchema, WithValidationOptions } from "./types";

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
 * @deprecated Use `createAction().input(schema).use(middleware).handle(fn)` instead.
 * This provides better type inference and a more composable API.
 *
 * @example
 * ```ts
 * // Old way (deprecated):
 * const protectedAction = applyMiddleware(
 *     myServerAction,
 *     [withAuth, withLogging, withValidation]
 * );
 *
 * // New way:
 * const protectedAction = createAction()
 *     .input(schema)
 *     .use(withAuth)
 *     .use(withLogging)
 *     .handle(async (ctx, input) => { ... });
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
 * @deprecated Use `createAction().use(mw1).use(mw2).handle(fn)` instead.
 * The builder pattern provides better type inference for chained middleware.
 *
 * @example
 * ```ts
 * // Old way (deprecated):
 * const combined = composeMiddleware(withAuth, withLogging, withValidation);
 * const protectedAction = applyMiddleware(myAction, [combined]);
 *
 * // New way:
 * const protectedAction = createAction()
 *     .input(schema)
 *     .use(withAuth)
 *     .use(withLogging)
 *     .handle(async (ctx, input) => { ... });
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

/**
 * Creates a middleware that validates the first parameter against a schema.
 * Works with Zod, Valibot, or any library with a compatible safeParse method.
 *
 * @deprecated Use `createAction().input(schema).handle(fn)` instead.
 * The `.input()` method provides automatic type inference from the schema.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const schema = z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 * });
 *
 * // Old way (deprecated):
 * const createUser = applyMiddleware(
 *     serverAction(async (input: z.infer<typeof schema>) => {
 *         return await db.user.create({ data: input });
 *     }),
 *     [withZodValidation(schema)]
 * );
 *
 * // New way:
 * const createUser = createAction()
 *     .input(schema)  // Type is inferred automatically!
 *     .handle(async (ctx, input) => {
 *         return { ok: true, data: await db.user.create({ data: input }) };
 *     });
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

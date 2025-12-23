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

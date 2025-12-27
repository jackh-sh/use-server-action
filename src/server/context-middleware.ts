"use server";

import type { BaseContext, ContextMiddleware } from "./types";

/**
 * Symbol to identify context-aware middleware at runtime
 */
export const CONTEXT_MIDDLEWARE = Symbol("contextMiddleware");

/**
 * Check if a middleware is context-aware
 */
export function isContextMiddleware(fn: unknown): boolean {
    return typeof fn === "function" && (fn as any)[CONTEXT_MIDDLEWARE] === true;
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
    (handler as any)[CONTEXT_MIDDLEWARE] = true;
    return handler;
}

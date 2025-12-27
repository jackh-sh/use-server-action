"use server";

import type { ServerActionResult } from "./server-action";

/**
 * Base context type - all contexts extend from this
 */
export type BaseContext = Record<string, unknown>;

/**
 * A middleware function that wraps a server action.
 * Receives the next function in the chain and the parameters passed to the action.
 */
export type Middleware<P extends unknown[], T> = (
    next: (...params: P) => Promise<ServerActionResult<T>>,
    ...params: P
) => Promise<ServerActionResult<T>>;

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

"use server";

import { HandledError } from "./errors";

export type ServerActionSuccess<T> = {
    ok: true;
    data: T;
};

export type ServerActionError = {
    ok: false;
    message: string;
    code?: string;
};

export type ServerActionResult<T> = ServerActionSuccess<T> | ServerActionError;

export function success<T>(data: T): ServerActionSuccess<T> {
    return { ok: true, data };
}

export function error(message: string, code?: string): ServerActionError {
    return { ok: false, message, code };
}

export type ServerActionFn<P extends unknown[], T> = (
    ...args: P
) => Promise<ServerActionResult<T>>;

type ServerActionOptions = {
    onError?: (error: unknown) => void;
};

/**
 * Wraps an async function to return a standardized ServerActionResult.
 * Catches any thrown errors and converts them to error results.
 */
export function serverAction<P extends unknown[], T>(
    fn: (...args: P) => Promise<T>,
    options?: ServerActionOptions,
): ServerActionFn<P, T> {
    return async (...args: P): Promise<ServerActionResult<T>> => {
        try {
            const data = await fn(...args);
            return success(data);
        } catch (err) {
            options?.onError?.(err);

            if (err instanceof HandledError) {
                return err.toServerActionError();
            }

            return error("An unexpected error occurred", "UNKNOWN_ERROR");
        }
    };
}

/**
 * Type guard to check if a result is successful
 */
export function isSuccess<T>(
    result: ServerActionResult<T>,
): result is ServerActionSuccess<T> {
    return result.ok === true;
}

/**
 * Type guard to check if a result is an error
 */
export function isError<T>(
    result: ServerActionResult<T>,
): result is ServerActionError {
    return result.ok === false;
}

/**
 * Unwraps a successful result or throws the error message
 */
export function unwrap<T>(result: ServerActionResult<T>): T {
    if (result.ok) {
        return result.data;
    }
    throw new Error(result.message);
}

/**
 * Unwraps a successful result or returns a default value
 */
export function unwrapOr<T>(result: ServerActionResult<T>, defaultValue: T): T {
    if (result.ok) {
        return result.data;
    }
    return defaultValue;
}

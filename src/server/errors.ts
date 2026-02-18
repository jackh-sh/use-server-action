import { ServerActionError } from "./server-action";

export class HandledError extends Error {
    private code: string | undefined;

    constructor(message: string, code?: string) {
        super(message);
        this.code = code;
    }

    toServerActionError(): ServerActionError {
        return {
            ok: false,
            message: this.message,
            code: this.code,
        };
    }
}

/**
 * Creates a HandledError from a Zod (or compatible) error.
 * Uses the first validation issue's message, falling back to the top-level message.
 *
 * @example
 * ```ts
 * const result = schema.safeParse(input);
 * if (!result.success) {
 *     throw fromZodError(result.error);
 * }
 * ```
 */
export function fromZodError(
    err: { message?: string; errors?: Array<{ message: string }> },
    code?: string,
): HandledError {
    const message =
        err.errors?.[0]?.message ?? err.message ?? "Validation failed";
    return new HandledError(message, code);
}

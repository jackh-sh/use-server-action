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

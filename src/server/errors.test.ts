import { describe, expect, it } from "vitest";
import { fromZodError, HandledError } from "./errors";

describe("HandledError", () => {
    it("should convert to a ServerActionError", () => {
        const err = new HandledError("Something went wrong", "MY_CODE");

        expect(err.toServerActionError()).toEqual({
            ok: false,
            message: "Something went wrong",
            code: "MY_CODE",
        });
    });

    it("should convert to a ServerActionError without a code", () => {
        const err = new HandledError("Something went wrong");

        expect(err.toServerActionError()).toEqual({
            ok: false,
            message: "Something went wrong",
            code: undefined,
        });
    });
});

describe("fromZodError", () => {
    it("should use the first issue message", () => {
        const err = fromZodError({
            errors: [{ message: "Name is required" }, { message: "Email is invalid" }],
        });

        expect(err).toBeInstanceOf(HandledError);
        expect(err.message).toBe("Name is required");
    });

    it("should fall back to the top-level message when errors array is absent", () => {
        const err = fromZodError({ message: "Schema-level error" });

        expect(err.message).toBe("Schema-level error");
    });

    it("should fall back to 'Validation failed' when no message is available", () => {
        const err = fromZodError({});

        expect(err.message).toBe("Validation failed");
    });

    it("should set the code when provided", () => {
        const err = fromZodError({ errors: [{ message: "Invalid" }] }, "CUSTOM_CODE");

        expect(err.toServerActionError()).toEqual({
            ok: false,
            message: "Invalid",
            code: "CUSTOM_CODE",
        });
    });

    it("should produce an error without a code when omitted", () => {
        const err = fromZodError({ errors: [{ message: "Invalid" }] });

        expect(err.toServerActionError()).toEqual({
            ok: false,
            message: "Invalid",
            code: undefined,
        });
    });
});

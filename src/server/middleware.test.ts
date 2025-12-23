import { describe, expect, it, vi } from "vitest";
import type { ServerActionResult } from "./server-action";
import {
    applyMiddleware,
    composeMiddleware,
    createMiddleware,
    withLogging,
    withValidation,
    type ValidationSchema,
} from "./middleware";

type TestData = { value: string };

const createSuccessAction = (data: TestData) => {
    return vi.fn(async (): Promise<ServerActionResult<TestData>> => {
        return { ok: true, data };
    });
};

const createErrorAction = (message: string, code?: string) => {
    return vi.fn(async (): Promise<ServerActionResult<TestData>> => {
        return { ok: false, message, code };
    });
};

describe("middleware", () => {
    describe("createMiddleware", () => {
        it("should create a middleware function", async () => {
            const middleware = createMiddleware<[string], TestData>(
                async (next, input) => {
                    return next(input);
                },
            );

            const action = createSuccessAction({ value: "test" });
            const result = await middleware(action, "input");

            expect(result).toEqual({ ok: true, data: { value: "test" } });
            expect(action).toHaveBeenCalledWith("input");
        });

        it("should allow modifying input params", async () => {
            const middleware = createMiddleware<[string], TestData>(
                async (next, input) => {
                    return next(input.toUpperCase());
                },
            );

            const action = vi.fn(
                async (input: string): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input } };
                },
            );

            const result = await middleware(action, "hello");

            expect(result).toEqual({ ok: true, data: { value: "HELLO" } });
        });

        it("should allow short-circuiting", async () => {
            const middleware = createMiddleware<[string], TestData>(
                async (next, input) => {
                    if (input === "blocked") {
                        return { ok: false, message: "Blocked", code: "BLOCKED" };
                    }
                    return next(input);
                },
            );

            const action = createSuccessAction({ value: "test" });
            const result = await middleware(action, "blocked");

            expect(result).toEqual({ ok: false, message: "Blocked", code: "BLOCKED" });
            expect(action).not.toHaveBeenCalled();
        });

        it("should allow modifying result", async () => {
            const middleware = createMiddleware<[], TestData>(async (next) => {
                const result = await next();
                if (result.ok) {
                    return {
                        ok: true,
                        data: { value: result.data.value + "_modified" },
                    };
                }
                return result;
            });

            const action = createSuccessAction({ value: "original" });
            const result = await middleware(action);

            expect(result).toEqual({ ok: true, data: { value: "original_modified" } });
        });
    });

    describe("applyMiddleware", () => {
        it("should apply single middleware", async () => {
            const callOrder: string[] = [];

            const middleware = createMiddleware<[], TestData>(async (next) => {
                callOrder.push("middleware:before");
                const result = await next();
                callOrder.push("middleware:after");
                return result;
            });

            const action = vi.fn(async (): Promise<ServerActionResult<TestData>> => {
                callOrder.push("action");
                return { ok: true, data: { value: "test" } };
            });

            const wrapped = applyMiddleware(action, [middleware]);
            await wrapped();

            expect(callOrder).toEqual([
                "middleware:before",
                "action",
                "middleware:after",
            ]);
        });

        it("should apply multiple middleware in order", async () => {
            const callOrder: string[] = [];

            const first = createMiddleware<[], TestData>(async (next) => {
                callOrder.push("first:before");
                const result = await next();
                callOrder.push("first:after");
                return result;
            });

            const second = createMiddleware<[], TestData>(async (next) => {
                callOrder.push("second:before");
                const result = await next();
                callOrder.push("second:after");
                return result;
            });

            const action = vi.fn(async (): Promise<ServerActionResult<TestData>> => {
                callOrder.push("action");
                return { ok: true, data: { value: "test" } };
            });

            const wrapped = applyMiddleware(action, [first, second]);
            await wrapped();

            expect(callOrder).toEqual([
                "first:before",
                "second:before",
                "action",
                "second:after",
                "first:after",
            ]);
        });

        it("should pass parameters through middleware chain", async () => {
            const middleware = createMiddleware<[string, number], TestData>(
                async (next, str, num) => {
                    return next(str + "_modified", num + 1);
                },
            );

            const action = vi.fn(
                async (
                    str: string,
                    num: number,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: `${str}:${num}` } };
                },
            );

            const wrapped = applyMiddleware(action, [middleware]);
            const result = await wrapped("test", 5);

            expect(result).toEqual({ ok: true, data: { value: "test_modified:6" } });
        });
    });

    describe("composeMiddleware", () => {
        it("should compose multiple middleware into one", async () => {
            const callOrder: string[] = [];

            const first = createMiddleware<[], TestData>(async (next) => {
                callOrder.push("first");
                return next();
            });

            const second = createMiddleware<[], TestData>(async (next) => {
                callOrder.push("second");
                return next();
            });

            const composed = composeMiddleware(first, second);
            const action = createSuccessAction({ value: "test" });

            await composed(action);

            expect(callOrder).toEqual(["first", "second"]);
        });
    });

    describe("withLogging", () => {
        it("should call onCall with params", async () => {
            const onCall = vi.fn();
            const middleware = withLogging<[string, number], TestData>({ onCall });
            const action = createSuccessAction({ value: "test" });

            await middleware(action, "hello", 42);

            expect(onCall).toHaveBeenCalledWith(["hello", 42]);
        });

        it("should call onSuccess for successful results", async () => {
            const onSuccess = vi.fn();
            const middleware = withLogging<[string], TestData>({ onSuccess });
            const action = createSuccessAction({ value: "test" });

            await middleware(action, "input");

            expect(onSuccess).toHaveBeenCalledWith({ value: "test" }, ["input"]);
        });

        it("should call onError for error results", async () => {
            const onError = vi.fn();
            const middleware = withLogging<[], TestData>({ onError });
            const action = createErrorAction("Failed", "FAIL_CODE");

            await middleware(action);

            expect(onError).toHaveBeenCalledWith("Failed", "FAIL_CODE", []);
        });

        it("should return the original result", async () => {
            const middleware = withLogging<[], TestData>({
                onCall: vi.fn(),
                onSuccess: vi.fn(),
            });
            const action = createSuccessAction({ value: "test" });

            const result = await middleware(action);

            expect(result).toEqual({ ok: true, data: { value: "test" } });
        });
    });

    describe("withValidation", () => {
        type UserInput = { name: string; email: string };

        // Mock schema that mimics Zod's safeParse interface
        const createMockSchema = <T>(
            validator: (data: unknown) => { valid: boolean; data?: T; message?: string },
        ): ValidationSchema<T> => ({
            safeParse: (data: unknown) => {
                const result = validator(data);
                if (result.valid) {
                    return { success: true, data: result.data as T };
                }
                return {
                    success: false,
                    error: { errors: [{ message: result.message ?? "Invalid" }] },
                };
            },
        });

        const validUserSchema = createMockSchema<UserInput>((data) => {
            const input = data as UserInput;
            if (!input.name || input.name.length < 1) {
                return { valid: false, message: "Name is required" };
            }
            if (!input.email || !input.email.includes("@")) {
                return { valid: false, message: "Invalid email" };
            }
            return { valid: true, data: input };
        });

        it("should pass valid data to next", async () => {
            const action = vi.fn(
                async (input: UserInput): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withValidation<UserInput, TestData>(validUserSchema);
            const result = await validated(action, { name: "John", email: "john@example.com" });

            expect(result).toEqual({ ok: true, data: { value: "John" } });
            expect(action).toHaveBeenCalledWith({ name: "John", email: "john@example.com" });
        });

        it("should return error for invalid data", async () => {
            const action = vi.fn(
                async (input: UserInput): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withValidation<UserInput, TestData>(validUserSchema);
            const result = await validated(action, { name: "", email: "john@example.com" });

            expect(result).toEqual({
                ok: false,
                message: "Name is required",
                code: "VALIDATION_ERROR",
            });
            expect(action).not.toHaveBeenCalled();
        });

        it("should use custom error code", async () => {
            const action = vi.fn(
                async (input: UserInput): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withValidation<UserInput, TestData>(validUserSchema, {
                code: "INVALID_INPUT",
            });
            const result = await validated(action, { name: "", email: "" });

            expect(result).toEqual({
                ok: false,
                message: "Name is required",
                code: "INVALID_INPUT",
            });
        });

        it("should use custom error formatter", async () => {
            const action = vi.fn(
                async (input: UserInput): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withValidation<UserInput, TestData>(validUserSchema, {
                formatError: (error) => `Custom: ${error.errors?.[0]?.message}`,
            });
            const result = await validated(action, { name: "", email: "" });

            expect(result).toEqual({
                ok: false,
                message: "Custom: Name is required",
                code: "VALIDATION_ERROR",
            });
        });

        it("should work with applyMiddleware", async () => {
            const action = vi.fn(
                async (input: UserInput): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const wrappedAction = applyMiddleware(action, [
                withValidation(validUserSchema),
            ]);

            const validResult = await wrappedAction({ name: "Jane", email: "jane@test.com" });
            expect(validResult).toEqual({ ok: true, data: { value: "Jane" } });

            const invalidResult = await wrappedAction({ name: "", email: "" });
            expect(invalidResult.ok).toBe(false);
        });

        it("should handle schema with message fallback", async () => {
            const schemaWithMessage: ValidationSchema<string> = {
                safeParse: () => ({
                    success: false,
                    error: { message: "Schema-level error" },
                }),
            };

            const action = vi.fn(
                async (): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: "test" } };
                },
            );

            const validated = withValidation<string, TestData>(schemaWithMessage);
            const result = await validated(action, "any");

            expect(result).toEqual({
                ok: false,
                message: "Schema-level error",
                code: "VALIDATION_ERROR",
            });
        });

        it("should fallback to default message", async () => {
            const schemaWithNoMessage: ValidationSchema<string> = {
                safeParse: () => ({
                    success: false,
                    error: {},
                }),
            };

            const action = vi.fn(
                async (): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: "test" } };
                },
            );

            const validated = withValidation<string, TestData>(schemaWithNoMessage);
            const result = await validated(action, "any");

            expect(result).toEqual({
                ok: false,
                message: "Validation failed",
                code: "VALIDATION_ERROR",
            });
        });
    });

    describe("integration", () => {
        it("should work with serverAction-style functions", async () => {
            const authMiddleware = createMiddleware<[{ token: string }], TestData>(
                async (next, params) => {
                    if (params.token !== "valid") {
                        return { ok: false, message: "Unauthorized", code: "UNAUTHORIZED" };
                    }
                    return next(params);
                },
            );

            const action = vi.fn(
                async (params: {
                    token: string;
                }): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: "protected data" } };
                },
            );

            const protectedAction = applyMiddleware(action, [authMiddleware]);

            // Should fail with invalid token
            const failResult = await protectedAction({ token: "invalid" });
            expect(failResult).toEqual({
                ok: false,
                message: "Unauthorized",
                code: "UNAUTHORIZED",
            });
            expect(action).not.toHaveBeenCalled();

            // Should succeed with valid token
            const successResult = await protectedAction({ token: "valid" });
            expect(successResult).toEqual({
                ok: true,
                data: { value: "protected data" },
            });
            expect(action).toHaveBeenCalledWith({ token: "valid" });
        });
    });
});

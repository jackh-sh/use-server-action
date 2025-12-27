import { describe, expect, it, vi } from "vitest";
import type { ServerActionResult } from "./server-action";
import {
    applyMiddleware,
    composeMiddleware,
    createMiddleware,
    withLogging,
    withZodValidation,
    createAction,
    createContextMiddleware,
    type ValidationSchema,
    type ContextMiddleware,
} from "./index";

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
                async (
                    input: string,
                ): Promise<ServerActionResult<TestData>> => {
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
                        return {
                            ok: false,
                            message: "Blocked",
                            code: "BLOCKED",
                        };
                    }
                    return next(input);
                },
            );

            const action = createSuccessAction({ value: "test" });
            const result = await middleware(action, "blocked");

            expect(result).toEqual({
                ok: false,
                message: "Blocked",
                code: "BLOCKED",
            });
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

            expect(result).toEqual({
                ok: true,
                data: { value: "original_modified" },
            });
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

            const action = vi.fn(
                async (): Promise<ServerActionResult<TestData>> => {
                    callOrder.push("action");
                    return { ok: true, data: { value: "test" } };
                },
            );

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

            const action = vi.fn(
                async (): Promise<ServerActionResult<TestData>> => {
                    callOrder.push("action");
                    return { ok: true, data: { value: "test" } };
                },
            );

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

            expect(result).toEqual({
                ok: true,
                data: { value: "test_modified:6" },
            });
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
            const middleware = withLogging<[string, number], TestData>({
                onCall,
            });
            const action = createSuccessAction({ value: "test" });

            await middleware(action, "hello", 42);

            expect(onCall).toHaveBeenCalledWith(["hello", 42]);
        });

        it("should call onSuccess for successful results", async () => {
            const onSuccess = vi.fn();
            const middleware = withLogging<[string], TestData>({ onSuccess });
            const action = createSuccessAction({ value: "test" });

            await middleware(action, "input");

            expect(onSuccess).toHaveBeenCalledWith({ value: "test" }, [
                "input",
            ]);
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
            validator: (data: unknown) => {
                valid: boolean;
                data?: T;
                message?: string;
            },
        ): ValidationSchema<T> => ({
            safeParse: (data: unknown) => {
                const result = validator(data);
                if (result.valid) {
                    return { success: true, data: result.data as T };
                }
                return {
                    success: false,
                    error: {
                        errors: [{ message: result.message ?? "Invalid" }],
                    },
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
                async (
                    input: UserInput,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withZodValidation<UserInput, TestData>(
                validUserSchema,
            );
            const result = await validated(action, {
                name: "John",
                email: "john@example.com",
            });

            expect(result).toEqual({ ok: true, data: { value: "John" } });
            expect(action).toHaveBeenCalledWith({
                name: "John",
                email: "john@example.com",
            });
        });

        it("should return error for invalid data", async () => {
            const action = vi.fn(
                async (
                    input: UserInput,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withZodValidation<UserInput, TestData>(
                validUserSchema,
            );
            const result = await validated(action, {
                name: "",
                email: "john@example.com",
            });

            expect(result).toEqual({
                ok: false,
                message: "Name is required",
                code: "VALIDATION_ERROR",
            });
            expect(action).not.toHaveBeenCalled();
        });

        it("should use custom error code", async () => {
            const action = vi.fn(
                async (
                    input: UserInput,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withZodValidation<UserInput, TestData>(
                validUserSchema,
                {
                    code: "INVALID_INPUT",
                },
            );
            const result = await validated(action, { name: "", email: "" });

            expect(result).toEqual({
                ok: false,
                message: "Name is required",
                code: "INVALID_INPUT",
            });
        });

        it("should use custom error formatter", async () => {
            const action = vi.fn(
                async (
                    input: UserInput,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const validated = withZodValidation<UserInput, TestData>(
                validUserSchema,
                {
                    formatError: (error) =>
                        `Custom: ${error.errors?.[0]?.message}`,
                },
            );
            const result = await validated(action, { name: "", email: "" });

            expect(result).toEqual({
                ok: false,
                message: "Custom: Name is required",
                code: "VALIDATION_ERROR",
            });
        });

        it("should work with applyMiddleware", async () => {
            const action = vi.fn(
                async (
                    input: UserInput,
                ): Promise<ServerActionResult<TestData>> => {
                    return { ok: true, data: { value: input.name } };
                },
            );

            const wrappedAction = applyMiddleware(action, [
                withZodValidation(validUserSchema),
            ]);

            const validResult = await wrappedAction({
                name: "Jane",
                email: "jane@test.com",
            });
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

            const validated = withZodValidation<string, TestData>(
                schemaWithMessage,
            );
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

            const validated = withZodValidation<string, TestData>(
                schemaWithNoMessage,
            );
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
            const authMiddleware = createMiddleware<
                [{ token: string }],
                TestData
            >(async (next, params) => {
                if (params.token !== "valid") {
                    return {
                        ok: false,
                        message: "Unauthorized",
                        code: "UNAUTHORIZED",
                    };
                }
                return next(params);
            });

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

    describe("context-aware middleware", () => {
        type User = { id: string; name: string };
        type Database = { query: (sql: string) => string };

        describe("createContextMiddleware", () => {
            it("should create a context middleware function", async () => {
                const middleware = createContextMiddleware<
                    [string],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, input) => {
                    return next(
                        { ...ctx, user: { id: "1", name: "John" } },
                        input,
                    );
                });

                const action = vi.fn(
                    async (
                        ctx: { user: User },
                        input: string,
                    ): Promise<ServerActionResult<TestData>> => {
                        return { ok: true, data: { value: ctx.user.name } };
                    },
                );

                const result = await middleware(action, {}, "test");
                expect(result).toEqual({ ok: true, data: { value: "John" } });
            });

            it("should allow short-circuiting", async () => {
                const middleware = createContextMiddleware<
                    [string],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, input) => {
                    if (input === "blocked") {
                        return {
                            ok: false,
                            message: "Blocked",
                            code: "BLOCKED",
                        };
                    }
                    return next(
                        { ...ctx, user: { id: "1", name: "John" } },
                        input,
                    );
                });

                const action = vi.fn(
                    async (
                        ctx: { user: User },
                        input: string,
                    ): Promise<ServerActionResult<TestData>> => {
                        return { ok: true, data: { value: ctx.user.name } };
                    },
                );

                const result = await middleware(action, {}, "blocked");
                expect(result).toEqual({
                    ok: false,
                    message: "Blocked",
                    code: "BLOCKED",
                });
                expect(action).not.toHaveBeenCalled();
            });
        });

        describe("createAction", () => {
            it("should build action with no middleware", async () => {
                const action = createAction<string>()
                    .handle(async (ctx, input) => {
                        return { ok: true, data: { value: input } };
                    });

                const result = await action("hello");
                expect(result).toEqual({ ok: true, data: { value: "hello" } });
            });

            it("should build action with no input", async () => {
                const action = createAction()
                    .handle(async (ctx) => {
                        return { ok: true, data: { value: "no input" } };
                    });

                const result = await action();
                expect(result).toEqual({ ok: true, data: { value: "no input" } });
            });

            it("should pass context from middleware to action", async () => {
                const withAuth = createContextMiddleware<
                    [string],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, input) => {
                    const user = { id: "123", name: "Alice" };
                    return next({ ...ctx, user }, input);
                });

                const action = createAction<string>()
                    .use(withAuth)
                    .handle(async (ctx, input) => {
                        return {
                            ok: true,
                            data: { value: `${ctx.user.name}: ${input}` },
                        };
                    });

                const result = await action("hello");
                expect(result).toEqual({
                    ok: true,
                    data: { value: "Alice: hello" },
                });
            });

            it("should accumulate context through multiple middleware", async () => {
                const withAuth = createContextMiddleware<
                    [string],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, input) => {
                    return next(
                        { ...ctx, user: { id: "1", name: "Bob" } },
                        input,
                    );
                });

                const withDb = createContextMiddleware<
                    [string],
                    TestData,
                    { user: User },
                    { db: Database }
                >(async (next, ctx, input) => {
                    const db = {
                        query: (sql: string) =>
                            `Result for ${sql} by ${ctx.user.name}`,
                    };
                    return next({ ...ctx, db }, input);
                });

                const action = createAction<string>()
                    .use(withAuth)
                    .use(withDb)
                    .handle(async (ctx, input) => {
                        return { ok: true, data: { value: ctx.db.query(input) } };
                    });

                const result = await action("SELECT * FROM users");
                expect(result).toEqual({
                    ok: true,
                    data: { value: "Result for SELECT * FROM users by Bob" },
                });
            });

            it("should execute middleware in correct order", async () => {
                const callOrder: string[] = [];

                const first = createContextMiddleware<
                    [],
                    TestData,
                    {},
                    { first: true }
                >(async (next, ctx) => {
                    callOrder.push("first:before");
                    const result = await next({ ...ctx, first: true as const });
                    callOrder.push("first:after");
                    return result;
                });

                const second = createContextMiddleware<
                    [],
                    TestData,
                    { first: true },
                    { second: true }
                >(async (next, ctx) => {
                    callOrder.push("second:before");
                    const result = await next({ ...ctx, second: true as const });
                    callOrder.push("second:after");
                    return result;
                });

                const action = createAction()
                    .use(first)
                    .use(second)
                    .handle(async () => {
                        callOrder.push("action");
                        return { ok: true, data: { value: "done" } };
                    });

                await action();

                expect(callOrder).toEqual([
                    "first:before",
                    "second:before",
                    "action",
                    "second:after",
                    "first:after",
                ]);
            });

            it("should allow middleware to short-circuit", async () => {
                const withAuth = createContextMiddleware<
                    [{ token: string }],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, params) => {
                    if (params.token !== "valid") {
                        return {
                            ok: false,
                            message: "Unauthorized",
                            code: "UNAUTHORIZED",
                        };
                    }
                    return next(
                        { ...ctx, user: { id: "1", name: "Auth User" } },
                        params,
                    );
                });

                const actionFn = vi.fn(
                    async (
                        ctx: { user: User },
                        params: { token: string },
                    ): Promise<ServerActionResult<TestData>> => {
                        return { ok: true, data: { value: ctx.user.name } };
                    },
                );

                const action = createAction<{ token: string }>()
                    .use(withAuth)
                    .handle(actionFn);

                // Invalid token should short-circuit
                const failResult = await action({ token: "invalid" });
                expect(failResult).toEqual({
                    ok: false,
                    message: "Unauthorized",
                    code: "UNAUTHORIZED",
                });
                expect(actionFn).not.toHaveBeenCalled();

                // Valid token should reach action
                const successResult = await action({ token: "valid" });
                expect(successResult).toEqual({
                    ok: true,
                    data: { value: "Auth User" },
                });
                expect(actionFn).toHaveBeenCalled();
            });

            it("should allow middleware to modify parameters", async () => {
                type TransformInput = { str: string; num: number };

                const withTransform = createContextMiddleware<
                    [TransformInput],
                    TestData,
                    {},
                    {}
                >(async (next, ctx, input) => {
                    return next(ctx, {
                        str: input.str.toUpperCase(),
                        num: input.num * 2,
                    });
                });

                const action = createAction<TransformInput>()
                    .use(withTransform)
                    .handle(async (ctx, input) => {
                        return {
                            ok: true,
                            data: { value: `${input.str}:${input.num}` },
                        };
                    });

                const result = await action({ str: "hello", num: 5 });
                expect(result).toEqual({
                    ok: true,
                    data: { value: "HELLO:10" },
                });
            });

            it("should allow middleware to access context from previous middleware", async () => {
                const withUser = createContextMiddleware<
                    [],
                    TestData,
                    {},
                    { userId: string }
                >(async (next, ctx) => {
                    return next({ ...ctx, userId: "user-123" });
                });

                const withPermissions = createContextMiddleware<
                    [],
                    TestData,
                    { userId: string },
                    { permissions: string[] }
                >(async (next, ctx) => {
                    const permissions =
                        ctx.userId === "user-123"
                            ? ["read", "write"]
                            : ["read"];
                    return next({ ...ctx, permissions });
                });

                const action = createAction()
                    .use(withUser)
                    .use(withPermissions)
                    .handle(async (ctx) => {
                        return {
                            ok: true,
                            data: {
                                value: `${ctx.userId}: ${ctx.permissions.join(",")}`,
                            },
                        };
                    });

                const result = await action();
                expect(result).toEqual({
                    ok: true,
                    data: { value: "user-123: read,write" },
                });
            });

            it("should work with regular (non-context) middleware", async () => {
                const callOrder: string[] = [];

                const loggingMiddleware = createMiddleware<
                    [string],
                    TestData
                >(async (next, input) => {
                    callOrder.push("logging:before");
                    const result = await next(input);
                    callOrder.push("logging:after");
                    return result;
                });

                const withUser = createContextMiddleware<
                    [string],
                    TestData,
                    {},
                    { user: User }
                >(async (next, ctx, input) => {
                    callOrder.push("withUser");
                    return next(
                        { ...ctx, user: { id: "1", name: "Test" } },
                        input,
                    );
                });

                const action = createAction<string>()
                    .use(loggingMiddleware)
                    .use(withUser)
                    .handle(async (ctx, input) => {
                        callOrder.push("action");
                        return {
                            ok: true,
                            data: { value: `${ctx.user.name}: ${input}` },
                        };
                    });

                const result = await action("hello");

                expect(result).toEqual({
                    ok: true,
                    data: { value: "Test: hello" },
                });
                expect(callOrder).toEqual([
                    "logging:before",
                    "withUser",
                    "action",
                    "logging:after",
                ]);
            });

            it("should support multiple input parameters", async () => {
                const action = createAction<[string, number]>()
                    .handle(async (ctx, name, count) => {
                        return {
                            ok: true,
                            data: { value: `${name}: ${count}` },
                        };
                    });

                const result = await action("items", 5);
                expect(result).toEqual({
                    ok: true,
                    data: { value: "items: 5" },
                });
            });
        });
    });
});

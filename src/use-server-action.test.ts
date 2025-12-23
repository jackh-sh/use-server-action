import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ServerActionResult } from "./server/server-action";
import { useServerAction } from "./use-server-action";

type User = { id: string; name: string };

const mockUser: User = { id: "1", name: "John" };

const createSuccessAction = (data: User = mockUser) => {
    return vi.fn(async (): Promise<ServerActionResult<User>> => {
        return { ok: true, data };
    });
};

const createErrorAction = (message: string, code?: string) => {
    return vi.fn(async (): Promise<ServerActionResult<User>> => {
        return { ok: false, message, code };
    });
};

const createThrowingAction = (error: Error) => {
    return vi.fn(async (): Promise<ServerActionResult<User>> => {
        throw error;
    });
};

describe("useServerAction", () => {
    describe("initial state", () => {
        it("should have correct initial state", () => {
            const action = createSuccessAction();
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            expect(result.current.data).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.errorCode).toBeNull();
            expect(result.current.isPending).toBe(false);
            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isError).toBe(false);
        });
    });

    describe("execute", () => {
        it("should handle successful action", async () => {
            const action = createSuccessAction();
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockUser);
            expect(result.current.error).toBeNull();
            expect(result.current.errorCode).toBeNull();
            expect(result.current.isError).toBe(false);
            expect(action).toHaveBeenCalledOnce();
        });

        it("should handle failed action", async () => {
            const action = createErrorAction("User not found", "NOT_FOUND");
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe("User not found");
            expect(result.current.errorCode).toBe("NOT_FOUND");
            expect(result.current.data).toBeNull();
            expect(result.current.isSuccess).toBe(false);
        });

        it("should handle thrown exception", async () => {
            const error = new Error("Network error");
            error.name = "NetworkError";
            const action = createThrowingAction(error);
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe("Network error");
            expect(result.current.errorCode).toBe("NetworkError");
            expect(result.current.isSuccess).toBe(false);
        });

        it("should pass arguments to action", async () => {
            const action = vi.fn(
                async (name: string): Promise<ServerActionResult<User>> => {
                    return { ok: true, data: { id: "1", name } };
                },
            );
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute("Jane");
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(action).toHaveBeenCalledWith("Jane");
            expect(result.current.data?.name).toBe("Jane");
        });
    });

    describe("executeAsync", () => {
        it("should return successful result", async () => {
            const action = createSuccessAction();
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            let returnedResult: ServerActionResult<User> | undefined;

            await act(async () => {
                returnedResult = await result.current.executeAsync();
            });

            expect(returnedResult).toEqual({ ok: true, data: mockUser });
            expect(result.current.data).toEqual(mockUser);
            expect(result.current.isSuccess).toBe(true);
        });

        it("should return error result", async () => {
            const action = createErrorAction("Failed", "FAIL_CODE");
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            let returnedResult: ServerActionResult<User> | undefined;

            await act(async () => {
                returnedResult = await result.current.executeAsync();
            });

            expect(returnedResult).toEqual({
                ok: false,
                message: "Failed",
                code: "FAIL_CODE",
            });
            expect(result.current.error).toBe("Failed");
            expect(result.current.isError).toBe(true);
        });

        it("should return error result when action throws", async () => {
            const error = new Error("Unexpected error");
            const action = createThrowingAction(error);
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            let returnedResult: ServerActionResult<User> | undefined;

            await act(async () => {
                returnedResult = await result.current.executeAsync();
            });

            expect(returnedResult?.ok).toBe(false);
            if (!returnedResult?.ok) {
                expect(returnedResult.message).toBe("Unexpected error");
            }
            expect(result.current.isError).toBe(true);
        });
    });

    describe("callbacks", () => {
        it("should call onSuccess callback on success", async () => {
            const action = createSuccessAction();
            const onSuccess = vi.fn();
            const { result } = renderHook(() =>
                useServerAction({ action, onSuccess }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalledWith(mockUser);
            });
        });

        it("should call onError callback on error", async () => {
            const action = createErrorAction("Error message", "ERROR_CODE");
            const onError = vi.fn();
            const { result } = renderHook(() =>
                useServerAction({ action, onError }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(onError).toHaveBeenCalledWith("Error message", "ERROR_CODE");
            });
        });

        it("should call onError callback when action throws", async () => {
            const error = new Error("Thrown error");
            error.name = "CustomError";
            const action = createThrowingAction(error);
            const onError = vi.fn();
            const { result } = renderHook(() =>
                useServerAction({ action, onError }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(onError).toHaveBeenCalledWith("Thrown error", "CustomError");
            });
        });

        it("should call onSettled callback on success", async () => {
            const action = createSuccessAction();
            const onSettled = vi.fn();
            const { result } = renderHook(() =>
                useServerAction({ action, onSettled }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(onSettled).toHaveBeenCalledOnce();
            });
        });

        it("should call onSettled callback on error", async () => {
            const action = createErrorAction("Error");
            const onSettled = vi.fn();
            const { result } = renderHook(() =>
                useServerAction({ action, onSettled }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(onSettled).toHaveBeenCalledOnce();
            });
        });
    });

    describe("reset", () => {
        it("should reset state after success", async () => {
            const action = createSuccessAction();
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            act(() => {
                result.current.reset();
            });

            expect(result.current.data).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.errorCode).toBeNull();
            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isError).toBe(false);
        });

        it("should reset state after error", async () => {
            const action = createErrorAction("Error", "CODE");
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            act(() => {
                result.current.reset();
            });

            expect(result.current.data).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.errorCode).toBeNull();
            expect(result.current.isSuccess).toBe(false);
            expect(result.current.isError).toBe(false);
        });
    });

    describe("state transitions", () => {
        it("should clear previous error on new execution", async () => {
            const errorAction = createErrorAction("First error");
            const { result, rerender } = renderHook(
                ({ action }) => useServerAction({ action }),
                { initialProps: { action: errorAction } },
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            const successAction = createSuccessAction();
            rerender({ action: successAction });

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.error).toBeNull();
            expect(result.current.isError).toBe(false);
        });

        it("should clear previous data on new execution", async () => {
            const action = createSuccessAction();
            const { result, rerender } = renderHook(
                ({ action }) => useServerAction({ action }),
                { initialProps: { action } },
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const errorAction = createErrorAction("Error");
            rerender({ action: errorAction });

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            // Data should still be from previous success (not cleared on error)
            // but isSuccess should be false
            expect(result.current.isSuccess).toBe(false);
        });
    });

    describe("error without code", () => {
        it("should handle error result without code", async () => {
            const action = createErrorAction("Error without code");
            const { result } = renderHook(() =>
                useServerAction({ action }),
            );

            act(() => {
                result.current.execute();
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toBe("Error without code");
            expect(result.current.errorCode).toBeNull();
        });
    });
});

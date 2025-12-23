"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ServerActionResult } from "./server/server-action";

export type UseServerActionInput<P extends unknown[], T> = {
    action: (...args: P) => Promise<ServerActionResult<T>>;
    onSuccess?: (data: T) => void;
    onError?: (message: string, code?: string) => void;
    onSettled?: () => void;
};

export type UseServerActionReturn<P extends unknown[], T> = {
    /** Whether the action is currently executing */
    isPending: boolean;
    /** Error message from the last failed execution */
    error: string | null;
    /** Error code from the last failed execution */
    errorCode: string | null;
    /** Data from the last successful execution */
    data: T | null;
    /** Whether the last execution was successful */
    isSuccess: boolean;
    /** Whether the last execution was an error */
    isError: boolean;
    /** Execute the action (wrapped in React transition) */
    execute: (...args: P) => void;
    /** Execute the action and return the result (not wrapped in transition) */
    executeAsync: (...args: P) => Promise<ServerActionResult<T>>;
    /** Reset state to initial values */
    reset: () => void;
};

export function useServerAction<P extends unknown[], T>(
    input: UseServerActionInput<P, T>,
): UseServerActionReturn<P, T> {
    const { action, onSuccess, onError, onSettled } = input;

    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [data, setData] = useState<T | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Use ref to always have latest callbacks without causing re-renders
    const callbacksRef = useRef({ onSuccess, onError, onSettled });
    callbacksRef.current = { onSuccess, onError, onSettled };

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleResult = useCallback((res: ServerActionResult<T>) => {
        if (!isMountedRef.current) return;

        if (res.ok) {
            setData(res.data);
            setError(null);
            setErrorCode(null);
            setIsSuccess(true);
            setIsError(false);
            callbacksRef.current.onSuccess?.(res.data);
        } else {
            setError(res.message);
            setErrorCode(res.code ?? null);
            setIsSuccess(false);
            setIsError(true);
            callbacksRef.current.onError?.(res.message, res.code);
        }
        callbacksRef.current.onSettled?.();
    }, []);

    const handleException = useCallback((err: unknown) => {
        if (!isMountedRef.current) return;

        const message = err instanceof Error ? err.message : "Unknown error";
        const code = err instanceof Error ? err.name : "UNKNOWN_ERROR";
        setError(message);
        setErrorCode(code);
        setIsSuccess(false);
        setIsError(true);
        callbacksRef.current.onError?.(message, code);
        callbacksRef.current.onSettled?.();
    }, []);

    const execute = useCallback(
        (...params: P) => {
            setError(null);
            setErrorCode(null);
            setIsSuccess(false);
            setIsError(false);

            startTransition(() => {
                action(...params).then(handleResult).catch(handleException);
            });
        },
        [action, handleResult, handleException],
    );

    const executeAsync = useCallback(
        async (...params: P): Promise<ServerActionResult<T>> => {
            setError(null);
            setErrorCode(null);
            setIsSuccess(false);
            setIsError(false);

            try {
                const res = await action(...params);
                handleResult(res);
                return res;
            } catch (err) {
                handleException(err);
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                const code =
                    err instanceof Error ? err.name : "UNKNOWN_ERROR";
                return { ok: false, message, code };
            }
        },
        [action, handleResult, handleException],
    );

    const reset = useCallback(() => {
        setError(null);
        setErrorCode(null);
        setData(null);
        setIsSuccess(false);
        setIsError(false);
    }, []);

    return {
        isPending,
        error,
        errorCode,
        data,
        isSuccess,
        isError,
        execute,
        executeAsync,
        reset,
    };
}

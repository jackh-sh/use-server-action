// Client hook
export { useServerAction } from "./use-server-action";
export type {
    UseServerActionInput,
    UseServerActionReturn,
} from "./use-server-action";

// Server utilities
export {
    serverAction,
    success,
    error,
    isSuccess,
    isError,
    unwrap,
    unwrapOr,
} from "./server/server-action";
export type {
    ServerActionResult,
    ServerActionSuccess,
    ServerActionError,
    ServerActionFn,
} from "./server/server-action";

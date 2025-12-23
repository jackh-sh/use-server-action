export { useServerAction } from "./use-server-action";
export type {
    UseServerActionInput,
    UseServerActionReturn,
} from "./use-server-action";

// Re-export types only from server (safe for client bundles)
export type {
    ServerActionResult,
    ServerActionSuccess,
    ServerActionError,
    ServerActionFn,
} from "./server/server-action";

import type { Rule } from "../types";
import { createAccessControlRule } from "./access-control";
import { createAsyncRaceRule } from "./async-race";
import { createBounceHandlingRule } from "./bounce-handling";
import { createDeadlockRule } from "./potential-deadlock";
import { createDumpCallRule } from "./dump-call";
import { createEmptyFunctionRule } from "./empty-function";
import { createExternalReplayProtectionRule } from "./external-replay-protection";
import { createLoopRule } from "./loop-usage";
import { createSendModeRule } from "./send-mode";
import { createTodoCommentRule } from "./todo-comment";

export function createRules(): Rule[] {
    return [
        createTodoCommentRule(),
        createEmptyFunctionRule(),
        createExternalReplayProtectionRule(),
        createAccessControlRule(),
        createLoopRule(),
        createDumpCallRule(),
        createSendModeRule(),
        createDeadlockRule(),
        createBounceHandlingRule(),
        createAsyncRaceRule(),
    ];
}

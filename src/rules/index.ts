import type { Rule } from "../types";
import { createAccessControlRule } from "./access-control";
import { createArgCopyMutationRule } from "./arg-copy-mutation";
import { createAsyncRaceRule } from "./async-race";
import { createBounceHandlingRule } from "./bounce-handling";
import { createCellBoundsRule } from "./cell-bounds";
import { createDeadlockRule } from "./potential-deadlock";
import { createDivideBeforeMultiplyRule } from "./divide-before-multiply";
import { createDuplicatedConditionRule } from "./duplicated-condition";
import { createDumpCallRule } from "./dump-call";
import { createEmptyFunctionRule } from "./empty-function";
import { createEnsurePrgSeedRule } from "./ensure-prg-seed";
import { createExitCodeUsageRule } from "./exit-code-usage";
import { createExternalReplayProtectionRule } from "./external-replay-protection";
import { createLoopRule } from "./loop-usage";
import { createSendInLoopRule } from "./send-in-loop";
import { createSendModeRule } from "./send-mode";
import { createStateMutationInGetterRule } from "./state-mutation-in-getter";
import { createTodoCommentRule } from "./todo-comment";
import { createZeroAddressRule } from "./zero-address";

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
        createCellBoundsRule(),
        createArgCopyMutationRule(),
        createDivideBeforeMultiplyRule(),
        createDuplicatedConditionRule(),
        createExitCodeUsageRule(),
        createSendInLoopRule(),
        createZeroAddressRule(),
        createStateMutationInGetterRule(),
        createEnsurePrgSeedRule(),
    ];
}

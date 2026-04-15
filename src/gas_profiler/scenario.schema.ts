import type { GasScenarioKind } from "./types";

export const SUPPORTED_GAS_SCENARIO_KINDS: readonly GasScenarioKind[] = [
    "deploy",
    "getter",
    "receive-empty",
    "receive-text",
    "receive-typed",
];

export function isSupportedScenarioKind(value: string): value is GasScenarioKind {
    return SUPPORTED_GAS_SCENARIO_KINDS.includes(value as GasScenarioKind);
}

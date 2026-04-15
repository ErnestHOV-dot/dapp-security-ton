import test from "node:test";
import assert from "node:assert/strict";
import { toJsonReport } from "../../src/gas_profiler/reporter";
import type { GasProfileReport } from "../../src/gas_profiler/types";

test("toJsonReport serializes bigint values as strings", () => {
    const report: GasProfileReport = {
        contractName: "Demo",
        generatedAt: "2026-04-15T00:00:00.000Z",
        inputFiles: {
            contractPath: "/tmp/Demo.tact",
            scenariosPath: "/tmp/demo.json",
        },
        scenarios: [
            {
                scenarioName: "deploy",
                scenarioKind: "deploy",
                metrics: [
                    {
                        gasUsed: 10n,
                        computeFee: 2n,
                        actionFee: 1n,
                        totalFees: 3n,
                        exitCode: 0,
                        actionResultCode: 0,
                        success: true,
                    },
                ],
                summary: {
                    totalGasUsed: 10n,
                    totalFees: 3n,
                    success: true,
                    transactionCount: 1,
                },
            },
        ],
        overall: {
            totalScenarios: 1,
            successfulScenarios: 1,
            failedScenarios: 0,
        },
    };

    assert.deepEqual(toJsonReport(report), {
        contractName: "Demo",
        generatedAt: "2026-04-15T00:00:00.000Z",
        inputFiles: {
            contractPath: "/tmp/Demo.tact",
            scenariosPath: "/tmp/demo.json",
        },
        scenarios: [
            {
                scenarioName: "deploy",
                scenarioKind: "deploy",
                metrics: [
                    {
                        gasUsed: "10",
                        computeFee: "2",
                        actionFee: "1",
                        totalFees: "3",
                        exitCode: 0,
                        actionResultCode: 0,
                        success: true,
                    },
                ],
                summary: {
                    totalGasUsed: "10",
                    totalFees: "3",
                    success: true,
                    transactionCount: 1,
                },
            },
        ],
        overall: {
            totalScenarios: 1,
            successfulScenarios: 1,
            failedScenarios: 0,
        },
    });
});

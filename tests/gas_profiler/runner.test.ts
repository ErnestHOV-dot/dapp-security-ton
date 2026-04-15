import test from "node:test";
import assert from "node:assert/strict";
import { Blockchain } from "@ton/sandbox";
import { runGasProfiler } from "../../src/gas_profiler/runner";
import type {
    ContractAdapter,
    ContractAdapterExecutionContext,
    GasScenario,
    GetterExecutionResult,
    ResolvedGasProfilerInput,
} from "../../src/gas_profiler/types";
import type { BlockchainTransaction } from "@ton/sandbox";

class MockAdapter implements ContractAdapter {
    public readonly contractName = "MockContract";
    public readonly address = { toString: () => "mock-address" } as ContractAdapter["address"];
    public readonly init = {} as NonNullable<ContractAdapter["init"]>;
    public deployCalls = 0;

    async deploy(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]> {
        this.deployCalls += 1;
        return [okTx(context.scenario.kind === "deploy" ? 100n : 10n)];
    }

    async callGetter(_scenario: GasScenario): Promise<GetterExecutionResult> {
        return {
            gasUsed: 55n,
            exitCode: 0,
            success: true,
        };
    }

    async sendEmpty(): Promise<BlockchainTransaction[]> {
        return [okTx(20n)];
    }

    async sendText(): Promise<BlockchainTransaction[]> {
        return [okTx(30n)];
    }

    async sendTyped(): Promise<BlockchainTransaction[]> {
        return [okTx(40n)];
    }
}

test("runGasProfiler builds report and auto-deploys baseline state", async () => {
    const blockchain = await Blockchain.create();
    const adapter = new MockAdapter();
    const input = createResolvedInput([
        { name: "text", kind: "receive-text", text: "ping" },
        { name: "getter", kind: "getter", methodName: "counter" },
    ]);

    const report = await runGasProfiler({ input, blockchain, adapter });

    assert.equal(report.contractName, "MockContract");
    assert.equal(report.overall.totalScenarios, 2);
    assert.equal(report.overall.successfulScenarios, 2);
    assert.equal(report.scenarios[0].summary.totalGasUsed, 30n);
    assert.equal(report.scenarios[1].summary.totalGasUsed, 55n);
    assert.equal(adapter.deployCalls, 2);
});

function createResolvedInput(scenarios: GasScenario[]): ResolvedGasProfilerInput {
    return {
        options: {
            contractPath: "/tmp/mock.tact",
            scenariosPath: "/tmp/mock.scenarios.json",
            format: "pretty",
        },
        inputFiles: {
            contractPath: "/tmp/mock.tact",
            scenariosPath: "/tmp/mock.scenarios.json",
            wrapperPath: "/tmp/mock-wrapper.ts",
        },
        outputPath: "/tmp/mock-report.json",
        scenarioFile: {
            contractName: "MockContract",
            scenarios,
        },
        wrapperExportName: "MockContract",
        wrapperModule: {},
    };
}

function okTx(gasUsed: bigint): BlockchainTransaction {
    return {
        description: {
            type: "generic",
            aborted: false,
            computePhase: {
                type: "vm",
                gasUsed,
                gasFees: 5n,
                exitCode: 0,
                success: true,
            },
            actionPhase: {
                totalActionFees: 2n,
                resultCode: 0,
                success: true,
            },
        },
        totalFees: { coins: 7n },
    } as unknown as BlockchainTransaction;
}

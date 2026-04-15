import test from "node:test";
import assert from "node:assert/strict";
import {
    extractTransactionMetrics,
    getActionFee,
    getComputeExitCode,
    getComputeFee,
    getComputeGasUsed,
    getTotalFees,
    isGenericTransaction,
} from "../../src/gas_profiler/extractor";
import type { BlockchainTransaction } from "@ton/sandbox";

function genericTx(overrides: Partial<BlockchainTransaction> = {}): BlockchainTransaction {
    return {
        description: {
            type: "generic",
            aborted: false,
            computePhase: {
                type: "vm",
                gasUsed: 123n,
                gasFees: 45n,
                exitCode: 0,
                success: true,
            },
            actionPhase: {
                totalActionFees: 7n,
                resultCode: 0,
                success: true,
            },
        },
        totalFees: { coins: 52n },
        ...overrides,
    } as unknown as BlockchainTransaction;
}

test("extractor returns metrics for generic vm transaction", () => {
    const tx = genericTx();

    assert.equal(isGenericTransaction(tx), true);
    assert.equal(getComputeGasUsed(tx), 123n);
    assert.equal(getComputeFee(tx), 45n);
    assert.equal(getActionFee(tx), 7n);
    assert.equal(getTotalFees(tx), 52n);
    assert.equal(getComputeExitCode(tx), 0);

    assert.deepEqual(extractTransactionMetrics(tx), {
        gasUsed: 123n,
        computeFee: 45n,
        actionFee: 7n,
        totalFees: 52n,
        exitCode: 0,
        actionResultCode: 0,
        success: true,
    });
});

test("extractor does not fail on skipped compute phase", () => {
    const tx = genericTx({
        description: {
            type: "generic",
            aborted: false,
            computePhase: {
                type: "skipped",
                reason: "no-state",
            },
            actionPhase: undefined,
        } as BlockchainTransaction["description"],
    });

    const metrics = extractTransactionMetrics(tx);
    assert.equal(metrics.gasUsed, null);
    assert.equal(metrics.computeFee, null);
    assert.equal(metrics.exitCode, null);
    assert.equal(metrics.success, true);
});

test("extractor does not fail on non-generic transaction", () => {
    const tx = {
        description: {
            type: "storage",
            storagePhase: {},
        },
        totalFees: { coins: 0n },
    } as unknown as BlockchainTransaction;

    const metrics = extractTransactionMetrics(tx);
    assert.equal(isGenericTransaction(tx), false);
    assert.equal(metrics.gasUsed, null);
    assert.equal(metrics.totalFees, 0n);
    assert.equal(metrics.success, true);
});

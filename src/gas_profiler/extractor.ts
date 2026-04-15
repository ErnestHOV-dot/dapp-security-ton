import type { BlockchainTransaction } from "@ton/sandbox";
import type { TransactionGasMetrics } from "./types";

export function isGenericTransaction(tx: BlockchainTransaction): boolean {
    return tx.description.type === "generic";
}

function getComputePhase(tx: BlockchainTransaction) {
    const description = getGenericDescription(tx);
    if (!description) {
        return null;
    }

    return description.computePhase;
}

function getActionPhase(tx: BlockchainTransaction) {
    const description = getGenericDescription(tx);
    if (!description) {
        return null;
    }

    return description.actionPhase ?? null;
}

function getGenericDescription(tx: BlockchainTransaction) {
    if (!isGenericTransaction(tx)) {
        return null;
    }

    // `BlockchainTransaction.description` is a tagged union from @ton/core.
    // After checking `type === "generic"` we can safely narrow it to the generic variant.
    return tx.description as Extract<BlockchainTransaction["description"], { type: "generic" }>;
}

export function getComputeGasUsed(tx: BlockchainTransaction): bigint | null {
    const computePhase = getComputePhase(tx);
    if (!computePhase || computePhase.type !== "vm") {
        return null;
    }

    return computePhase.gasUsed;
}

export function getComputeFee(tx: BlockchainTransaction): bigint | null {
    const computePhase = getComputePhase(tx);
    if (!computePhase || computePhase.type !== "vm") {
        return null;
    }

    return computePhase.gasFees;
}

export function getActionFee(tx: BlockchainTransaction): bigint | null {
    return getActionPhase(tx)?.totalActionFees ?? null;
}

export function getTotalFees(tx: BlockchainTransaction): bigint | null {
    return tx.totalFees?.coins ?? null;
}

export function getComputeExitCode(tx: BlockchainTransaction): number | null {
    const computePhase = getComputePhase(tx);
    if (!computePhase || computePhase.type !== "vm") {
        return null;
    }

    return computePhase.exitCode;
}

export function getActionResultCode(tx: BlockchainTransaction): number | null {
    return getActionPhase(tx)?.resultCode ?? null;
}

export function extractTransactionMetrics(tx: BlockchainTransaction): TransactionGasMetrics {
    const computePhase = getComputePhase(tx);
    const actionPhase = getActionPhase(tx);
    const description = getGenericDescription(tx);

    const computeSuccess = computePhase?.type === "vm" ? computePhase.success : true;
    const actionSuccess = actionPhase ? actionPhase.success : true;
    const txSuccess = description ? !description.aborted : true;

    return {
        gasUsed: getComputeGasUsed(tx),
        computeFee: getComputeFee(tx),
        actionFee: getActionFee(tx),
        totalFees: getTotalFees(tx),
        exitCode: getComputeExitCode(tx),
        actionResultCode: getActionResultCode(tx),
        success: computeSuccess && actionSuccess && txSuccess,
    };
}

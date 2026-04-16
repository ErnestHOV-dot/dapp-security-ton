import type { Address, Cell, StateInit, TupleItem } from "@ton/core";
import type { Blockchain, BlockchainTransaction, SandboxContract, TreasuryContract } from "@ton/sandbox";
import type { Issue } from "../types";

export type GasScenarioKind =
    | "deploy"
    | "getter"
    | "receive-empty"
    | "receive-text"
    | "receive-typed";

export interface GasScenarioDefaults {
    value?: string;
    senderName?: string;
}

export interface GasScenario {
    name: string;
    kind: GasScenarioKind;
    methodName?: string;
    args?: unknown[];
    text?: string;
    value?: string;
    senderName?: string;
    typedMessage?: Record<string, unknown>;
    note?: string;
}

export interface GasScenarioFile {
    contractName?: string;
    description?: string;
    defaults?: GasScenarioDefaults;
    initArgs?: unknown[];
    namedSenders?: Record<string, string>;
    scenarios: GasScenario[];
}

export interface GasProfilerCliOptions {
    contractPath?: string;
    scenariosPath?: string;
    buildPath?: string;
    wrapperPath?: string;
    outputPath?: string;
    format: "json" | "pretty";
}

export interface GasProfilerInputFiles {
    contractPath: string;
    scenariosPath: string;
    buildPath?: string;
    wrapperPath?: string;
}

export interface ResolvedGasProfilerInput {
    options: GasProfilerCliOptions;
    inputFiles: GasProfilerInputFiles;
    outputPath: string;
    scenarioFile: GasScenarioFile;
    wrapperExportName: string;
    wrapperModule: Record<string, unknown>;
}

export interface TransactionGasMetrics {
    gasUsed: bigint | null;
    computeFee: bigint | null;
    actionFee: bigint | null;
    totalFees: bigint | null;
    exitCode: number | null;
    actionResultCode: number | null;
    success: boolean;
}

export interface GasScenarioResult {
    scenarioName: string;
    scenarioKind: GasScenarioKind;
    metrics: TransactionGasMetrics[];
    note?: string;
    summary: {
        totalGasUsed: bigint | null;
        totalFees: bigint | null;
        success: boolean;
        transactionCount: number;
    };
}

export interface GasProfileReport {
    contractName: string;
    inputFiles: GasProfilerInputFiles;
    generatedAt: string;
    description?: string;
    scenarios: GasScenarioResult[];
    staticAnalysis?: {
        findings: Issue[];
        summary: {
            totalFindings: number;
        };
    };
    overall: {
        totalScenarios: number;
        successfulScenarios: number;
        failedScenarios: number;
    };
}

export interface SerializedTransactionGasMetrics {
    gasUsed: string | null;
    computeFee: string | null;
    actionFee: string | null;
    totalFees: string | null;
    exitCode: number | null;
    actionResultCode: number | null;
    success: boolean;
}

export interface SerializedGasScenarioResult {
    scenarioName: string;
    scenarioKind: GasScenarioKind;
    metrics: SerializedTransactionGasMetrics[];
    note?: string;
    summary: {
        totalGasUsed: string | null;
        totalFees: string | null;
        success: boolean;
        transactionCount: number;
    };
}

export interface SerializedGasProfileReport {
    contractName: string;
    inputFiles: GasProfilerInputFiles;
    generatedAt: string;
    description?: string;
    scenarios: SerializedGasScenarioResult[];
    staticAnalysis?: {
        findings: Issue[];
        summary: {
            totalFindings: number;
        };
    };
    overall: {
        totalScenarios: number;
        successfulScenarios: number;
        failedScenarios: number;
    };
}

export interface GetterExecutionResult {
    gasUsed: bigint | null;
    exitCode: number | null;
    success: boolean;
}

export interface ContractAdapterExecutionContext {
    blockchain: Blockchain;
    sender: SandboxContract<TreasuryContract>;
    scenario: GasScenario;
    defaultValue?: string;
    includeInit?: boolean;
}

export interface ContractAdapter {
    readonly contractName: string;
    readonly address: Address;
    readonly init?: StateInit | null;
    deploy(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]>;
    callGetter(scenario: GasScenario): Promise<GetterExecutionResult>;
    sendEmpty(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]>;
    sendText(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]>;
    sendTyped(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]>;
}

export interface GasProfilerOptions {
    input: ResolvedGasProfilerInput;
    blockchain?: Blockchain;
    adapter?: ContractAdapter;
    createAdapter?: (input: ResolvedGasProfilerInput, blockchain: Blockchain) => Promise<ContractAdapter>;
}

export interface WrapperContractInstance {
    address: Address;
    init?: StateInit | null;
}

export interface WrapperContractClass {
    fromInit?: (...args: unknown[]) => Promise<WrapperContractInstance>;
    fromAddress?: (address: Address) => WrapperContractInstance;
}

export interface NormalizedTupleArg {
    raw: unknown;
    tuple: TupleItem;
}

import { beginCell, Cell, type Message, type StateInit } from "@ton/core";
import { Blockchain } from "@ton/sandbox";
import type { BlockchainTransaction, SandboxContract, TreasuryContract } from "@ton/sandbox";
import {
    buildCommentCell,
    coerceTupleItem,
    normalizeDecimalStrings,
    toBigIntValue,
} from "../utils";
import type {
    ContractAdapter,
    ContractAdapterExecutionContext,
    GasScenario,
    GetterExecutionResult,
    ResolvedGasProfilerInput,
    WrapperContractClass,
    WrapperContractInstance,
} from "../types";

export class TactContractAdapter implements ContractAdapter {
    public readonly contractName: string;
    public readonly address;
    public readonly init?: StateInit | null;

    private readonly contractInstance: WrapperContractInstance;
    private readonly contractClass: WrapperContractClass;

    private constructor(
        private readonly input: ResolvedGasProfilerInput,
        private readonly blockchain: Blockchain,
        contractName: string,
        contractClass: WrapperContractClass,
        contractInstance: WrapperContractInstance,
    ) {
        this.contractName = contractName;
        this.contractClass = contractClass;
        this.contractInstance = contractInstance;
        this.address = contractInstance.address;
        this.init = contractInstance.init;
    }

    static async create(input: ResolvedGasProfilerInput, blockchain: Blockchain): Promise<TactContractAdapter> {
        const contractName = input.wrapperExportName;
        const contractClass = input.wrapperModule[contractName] as WrapperContractClass | undefined;

        if (!contractClass) {
            throw new Error(`Экспорт '${contractName}' не найден в wrapper '${input.inputFiles.wrapperPath}'.`);
        }

        if (typeof contractClass.fromInit !== "function") {
            throw new Error(
                `Wrapper '${contractName}' не поддерживает fromInit(). Для первой версии profiler ожидается generated Tact wrapper с fromInit().`,
            );
        }

        const contractInstance = await contractClass.fromInit();
        return new TactContractAdapter(input, blockchain, contractName, contractClass, contractInstance);
    }

    async deploy(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]> {
        return this.sendInternalMessage(context.sender, this.resolveDeployBody(context.scenario), {
            includeInit: context.includeInit ?? true,
            value: this.resolveValue(context.scenario, context.defaultValue),
            bounce: false,
        });
    }

    async callGetter(scenario: GasScenario): Promise<GetterExecutionResult> {
        if (!scenario.methodName) {
            throw new Error(`Scenario '${scenario.name}' is missing methodName.`);
        }

        const args = (scenario.args ?? []).map((entry) => coerceTupleItem(entry));

        try {
            const result = await this.blockchain.runGetMethod(this.address, scenario.methodName, args);
            return {
                gasUsed: result.gasUsed ?? null,
                exitCode: result.exitCode,
                success: result.exitCode === 0,
            };
        } catch (error) {
            if (typeof error === "object" && error !== null && "exitCode" in error) {
                const candidate = error as { exitCode?: number; gasUsed?: bigint };
                return {
                    gasUsed: candidate.gasUsed ?? null,
                    exitCode: candidate.exitCode ?? null,
                    success: false,
                };
            }

            throw error;
        }
    }

    async sendEmpty(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]> {
        return this.sendInternalMessage(context.sender, Cell.EMPTY, {
            includeInit: context.includeInit ?? false,
            value: this.resolveValue(context.scenario, context.defaultValue),
            bounce: true,
        });
    }

    async sendText(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]> {
        if (!context.scenario.text) {
            throw new Error(`Scenario '${context.scenario.name}' is missing text.`);
        }

        return this.sendInternalMessage(context.sender, buildCommentCell(context.scenario.text), {
            includeInit: context.includeInit ?? false,
            value: this.resolveValue(context.scenario, context.defaultValue),
            bounce: true,
        });
    }

    async sendTyped(context: ContractAdapterExecutionContext): Promise<BlockchainTransaction[]> {
        const typedMessage = context.scenario.typedMessage;
        if (!typedMessage) {
            throw new Error(`Scenario '${context.scenario.name}' is missing typedMessage.`);
        }

        return this.sendInternalMessage(context.sender, this.serializeTypedMessage(typedMessage), {
            includeInit: context.includeInit ?? false,
            value: this.resolveValue(context.scenario, context.defaultValue),
            bounce: true,
        });
    }

    private async sendInternalMessage(
        sender: SandboxContract<TreasuryContract>,
        body: Cell,
        options: {
            includeInit: boolean;
            value: bigint;
            bounce: boolean;
        },
    ): Promise<BlockchainTransaction[]> {
        const message: Message = {
            info: {
                type: "internal",
                ihrDisabled: true,
                bounce: options.bounce,
                bounced: false,
                src: sender.address,
                dest: this.address,
                value: { coins: options.value },
                ihrFee: 0n,
                forwardFee: 0n,
                createdLt: 0n,
                createdAt: 0,
            },
            init: options.includeInit ? this.init ?? undefined : undefined,
            body,
        };

        const result = await this.blockchain.sendMessage(message, {
            now: this.blockchain.now,
            randomSeed: Buffer.alloc(32, 1),
        });

        return result.transactions;
    }

    private resolveDeployBody(scenario: GasScenario): Cell {
        if (scenario.typedMessage) {
            return this.serializeTypedMessage(scenario.typedMessage);
        }

        const storeDeploy = this.input.wrapperModule.storeDeploy;
        if (typeof storeDeploy === "function") {
            return this.serializeUsingStore("Deploy", { $$type: "Deploy", queryId: 0n });
        }

        if (scenario.text) {
            return buildCommentCell(scenario.text);
        }

        return Cell.EMPTY;
    }

    private serializeTypedMessage(message: Record<string, unknown>): Cell {
        const normalizedMessage = normalizeDecimalStrings(message) as Record<string, unknown>;
        const typeName = normalizedMessage.$$type;
        if (typeof typeName !== "string") {
            throw new Error(
                "typedMessage должен содержать строковое поле '$$type'. В первой версии profiler typed message строится через generated store<MsgType>().",
            );
        }

        return this.serializeUsingStore(typeName, normalizedMessage);
    }

    private serializeUsingStore(typeName: string, message: Record<string, unknown>): Cell {
        const storeFunctionName = `store${typeName}`;
        const storeFunction = this.input.wrapperModule[storeFunctionName];
        if (typeof storeFunction !== "function") {
            throw new Error(
                `Wrapper '${this.contractName}' не экспортирует ${storeFunctionName}(). Typed scenario '${typeName}' пока недоступен для этого контракта.`,
            );
        }

        const builder = beginCell();
        builder.store((storeFunction as (src: Record<string, unknown>) => (builder: unknown) => void)(message));
        return builder.endCell();
    }

    private resolveValue(scenario: GasScenario, defaultValue?: string): bigint {
        return toBigIntValue(scenario.value, toBigIntValue(defaultValue, 0n));
    }
}

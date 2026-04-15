import { Blockchain } from "@ton/sandbox";
import { extractTransactionMetrics } from "./extractor";
import { sumNullableBigints } from "./utils";
import { TactContractAdapter } from "./adapters/contract-adapter";
import type {
    ContractAdapter,
    GasProfileReport,
    GasProfilerOptions,
    GasScenario,
    GasScenarioResult,
    GetterExecutionResult,
    TransactionGasMetrics,
} from "./types";

export async function runGasProfiler(options: GasProfilerOptions): Promise<GasProfileReport> {
    const blockchain = options.blockchain ?? (await Blockchain.create());
    const adapter =
        options.adapter ??
        (options.createAdapter
            ? await options.createAdapter(options.input, blockchain)
            : await TactContractAdapter.create(options.input, blockchain));

    const senders = await createSenders(blockchain, options.input.scenarioFile.scenarios);
    const initialSnapshot = blockchain.snapshot();
    const baselineDeployScenario = buildBaselineDeployScenario(options.input.scenarioFile.scenarios);
    const scenarioResults: GasScenarioResult[] = [];

    for (const scenario of options.input.scenarioFile.scenarios) {
        await blockchain.loadFrom(initialSnapshot);

        if (scenario.kind !== "deploy" && adapter.init) {
            await adapter.deploy({
                blockchain,
                sender: resolveSender(senders, baselineDeployScenario.senderName),
                scenario: baselineDeployScenario,
                defaultValue: options.input.scenarioFile.defaults?.value,
                includeInit: true,
            });
        }

        scenarioResults.push(
            await executeScenario(adapter, blockchain, senders, scenario, options.input.scenarioFile.defaults?.value),
        );
    }

    const successfulScenarios = scenarioResults.filter((scenario) => scenario.summary.success).length;

    return {
        contractName: options.input.scenarioFile.contractName ?? adapter.contractName,
        description: options.input.scenarioFile.description,
        inputFiles: options.input.inputFiles,
        generatedAt: new Date().toISOString(),
        scenarios: scenarioResults,
        overall: {
            totalScenarios: scenarioResults.length,
            successfulScenarios,
            failedScenarios: scenarioResults.length - successfulScenarios,
        },
    };
}

async function executeScenario(
    adapter: ContractAdapter,
    blockchain: Blockchain,
    senders: Record<string, Awaited<ReturnType<Blockchain["treasury"]>>>,
    scenario: GasScenario,
    defaultValue?: string,
): Promise<GasScenarioResult> {
    if (scenario.kind === "getter") {
        const getterResult = await adapter.callGetter(scenario);
        return buildGetterScenarioResult(scenario, getterResult);
    }

    const sender = resolveSender(senders, scenario.senderName);
    const context = {
        blockchain,
        sender,
        scenario,
        defaultValue,
        includeInit: scenario.kind === "deploy",
    } as const;

    const transactions =
        scenario.kind === "deploy"
            ? await adapter.deploy(context)
            : scenario.kind === "receive-empty"
              ? await adapter.sendEmpty(context)
              : scenario.kind === "receive-text"
                ? await adapter.sendText(context)
                : await adapter.sendTyped(context);

    const metrics = transactions.map((tx) => extractTransactionMetrics(tx));
    return buildScenarioResult(scenario, metrics);
}

function buildGetterScenarioResult(scenario: GasScenario, getterResult: GetterExecutionResult): GasScenarioResult {
    const metrics: TransactionGasMetrics[] = [
        {
            gasUsed: getterResult.gasUsed,
            computeFee: null,
            actionFee: null,
            totalFees: null,
            exitCode: getterResult.exitCode,
            actionResultCode: null,
            success: getterResult.success,
        },
    ];

    return buildScenarioResult(scenario, metrics);
}

function buildScenarioResult(
    scenario: GasScenario,
    metrics: TransactionGasMetrics[],
): GasScenarioResult {
    return {
        scenarioName: scenario.name,
        scenarioKind: scenario.kind,
        note: scenario.note,
        metrics,
        summary: {
            totalGasUsed: sumNullableBigints(metrics.map((metric) => metric.gasUsed)),
            totalFees: sumNullableBigints(metrics.map((metric) => metric.totalFees)),
            success: metrics.every((metric) => metric.success),
            transactionCount: metrics.length,
        },
    };
}

async function createSenders(
    blockchain: Blockchain,
    scenarios: GasScenario[],
): Promise<Record<string, Awaited<ReturnType<Blockchain["treasury"]>>>> {
    const names = new Set(["deployer", "sender", "user"]);
    for (const scenario of scenarios) {
        if (scenario.senderName) {
            names.add(scenario.senderName);
        }
    }

    const senders: Record<string, Awaited<ReturnType<Blockchain["treasury"]>>> = {};
    for (const name of names) {
        senders[name] = await blockchain.treasury(name);
    }

    return senders;
}

function resolveSender(
    senders: Record<string, Awaited<ReturnType<Blockchain["treasury"]>>>,
    senderName = "deployer",
) {
    const sender = senders[senderName];
    if (!sender) {
        throw new Error(`Sender '${senderName}' не найден.`);
    }

    return sender;
}

function buildBaselineDeployScenario(scenarios: GasScenario[]): GasScenario {
    const explicitDeployScenario = scenarios.find((scenario) => scenario.kind === "deploy");
    if (explicitDeployScenario) {
        return explicitDeployScenario;
    }

    return {
        name: "__baseline_deploy__",
        kind: "deploy",
        senderName: "deployer",
    };
}

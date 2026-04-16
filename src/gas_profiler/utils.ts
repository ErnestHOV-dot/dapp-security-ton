import { beginCell, Cell, type TupleItem } from "@ton/core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
    GasProfileReport,
    GasScenarioResult,
    SerializedGasProfileReport,
    SerializedGasScenarioResult,
    SerializedTransactionGasMetrics,
    TransactionGasMetrics,
} from "./types";

export function toBigIntValue(value: string | bigint | undefined, fallback = 0n): bigint {
    if (value === undefined) {
        return fallback;
    }

    return typeof value === "bigint" ? value : BigInt(value);
}

export function nullableBigIntToString(value: bigint | null): string | null {
    return value === null ? null : value.toString();
}

export function sumNullableBigints(values: Array<bigint | null>): bigint | null {
    const present = values.filter((value): value is bigint => value !== null);
    if (present.length === 0) {
        return null;
    }

    return present.reduce((sum, value) => sum + value, 0n);
}

export function serializeTransactionMetrics(metrics: TransactionGasMetrics): SerializedTransactionGasMetrics {
    return {
        gasUsed: nullableBigIntToString(metrics.gasUsed),
        computeFee: nullableBigIntToString(metrics.computeFee),
        actionFee: nullableBigIntToString(metrics.actionFee),
        totalFees: nullableBigIntToString(metrics.totalFees),
        exitCode: metrics.exitCode,
        actionResultCode: metrics.actionResultCode,
        success: metrics.success,
    };
}

export function serializeScenarioResult(result: GasScenarioResult): SerializedGasScenarioResult {
    return {
        scenarioName: result.scenarioName,
        scenarioKind: result.scenarioKind,
        ...(result.note !== undefined ? { note: result.note } : {}),
        metrics: result.metrics.map(serializeTransactionMetrics),
        summary: {
            totalGasUsed: nullableBigIntToString(result.summary.totalGasUsed),
            totalFees: nullableBigIntToString(result.summary.totalFees),
            success: result.summary.success,
            transactionCount: result.summary.transactionCount,
        },
    };
}

export function serializeReport(report: GasProfileReport): SerializedGasProfileReport {
    return {
        contractName: report.contractName,
        inputFiles: report.inputFiles,
        generatedAt: report.generatedAt,
        ...(report.description !== undefined ? { description: report.description } : {}),
        scenarios: report.scenarios.map(serializeScenarioResult),
        ...(report.staticAnalysis !== undefined ? { staticAnalysis: report.staticAnalysis } : {}),
        overall: report.overall,
    };
}

export function ensureDirectoryForFile(targetPath: string): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

export function formatNullableBigint(value: bigint | null): string {
    return value === null ? "n/a" : value.toString();
}

export function formatNanotonsAsTon(value: bigint | null): string {
    if (value === null) {
        return "n/a";
    }

    const sign = value < 0n ? "-" : "";
    const normalized = value < 0n ? -value : value;
    const whole = normalized / 1_000_000_000n;
    const fractional = (normalized % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");

    return fractional.length > 0 ? `${sign}${whole}.${fractional}` : `${sign}${whole}`;
}

export function padRight(value: string, width: number): string {
    return value.padEnd(width, " ");
}

export function findUp(filename: string, startPath: string): string | undefined {
    let current = path.resolve(startPath);

    while (true) {
        const candidate = path.join(current, filename);
        if (fs.existsSync(candidate)) {
            return candidate;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            return undefined;
        }

        current = parent;
    }
}

export function runTactBuild(configPath: string, projectName?: string): void {
    const args = ["tact", "--config", configPath];
    if (projectName) {
        args.push("--project", projectName);
    }

    const result = spawnSync("npx", args, {
        cwd: path.dirname(configPath),
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        throw new Error(
            `Не удалось собрать Tact-проект через '${args.join(" ")}': ${result.stderr || result.stdout || "unknown error"}`,
        );
    }
}

export function loadJsonFile<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, "utf-8");

    try {
        return JSON.parse(raw) as T;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Некорректный JSON в '${filePath}': ${message}`);
    }
}

export function loadModule(modulePath: string): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as Record<string, unknown>;
}

export function normalizeDecimalStrings(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeDecimalStrings(entry));
    }

    if (!value || typeof value !== "object") {
        if (typeof value === "string" && /^-?\d+$/.test(value)) {
            return BigInt(value);
        }
        return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key === "$$type") {
            result[key] = entry;
            continue;
        }
        result[key] = normalizeDecimalStrings(entry);
    }
    return result;
}

export function buildCommentCell(text: string): Cell {
    return beginCell().storeUint(0, 32).storeStringTail(text).endCell();
}

export function coerceTupleItem(value: unknown): TupleItem {
    if (value === null) {
        return { type: "null" };
    }

    if (typeof value === "number") {
        if (!Number.isInteger(value)) {
            throw new Error(`Getter argument '${value}' must be an integer.`);
        }
        return { type: "int", value: BigInt(value) };
    }

    if (typeof value === "bigint") {
        return { type: "int", value };
    }

    if (typeof value === "string") {
        if (/^-?\d+$/.test(value)) {
            return { type: "int", value: BigInt(value) };
        }

        throw new Error(
            `Getter string argument '${value}' is not supported directly. Use an object form like { "type": "cell", "base64": "..." } if needed.`,
        );
    }

    if (typeof value !== "object" || value === undefined) {
        throw new Error(`Unsupported getter argument type: ${typeof value}`);
    }

    const record = value as Record<string, unknown>;
    switch (record.type) {
        case "null":
            return { type: "null" };
        case "int":
            return { type: "int", value: toBigIntValue(String(record.value)) };
        case "cell": {
            if (typeof record.base64 !== "string") {
                throw new Error("Tuple item { type: 'cell' } requires 'base64'.");
            }
            return { type: "cell", cell: Cell.fromBase64(record.base64) };
        }
        case "slice": {
            if (typeof record.base64 !== "string") {
                throw new Error("Tuple item { type: 'slice' } requires 'base64'.");
            }
            return { type: "slice", cell: Cell.fromBase64(record.base64) };
        }
        case "builder": {
            if (typeof record.base64 !== "string") {
                throw new Error("Tuple item { type: 'builder' } requires 'base64'.");
            }
            return { type: "builder", cell: Cell.fromBase64(record.base64) };
        }
        case "tuple": {
            if (!Array.isArray(record.items)) {
                throw new Error("Tuple item { type: 'tuple' } requires 'items'.");
            }
            return {
                type: "tuple",
                items: record.items.map((entry) => coerceTupleItem(entry)),
            };
        }
        default:
            throw new Error(`Unsupported getter tuple item type '${String(record.type)}'.`);
    }
}

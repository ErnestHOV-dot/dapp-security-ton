import fs from "node:fs";
import {
    ensureDirectoryForFile,
    formatNanotonsAsTon,
    formatNullableBigint,
    padRight,
    serializeReport,
} from "./utils";
import type { GasProfileReport, SerializedGasProfileReport } from "./types";

export function buildGasProfileReport(report: GasProfileReport): GasProfileReport {
    return report;
}

export function toJsonReport(report: GasProfileReport): SerializedGasProfileReport {
    return serializeReport(report);
}

export function saveGasProfileReport(report: GasProfileReport, outputPath: string): void {
    ensureDirectoryForFile(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(toJsonReport(report), null, 2), "utf-8");
}

export function printGasProfileReport(report: GasProfileReport): void {
    const scenarioWidth = Math.max(
        "Scenario".length,
        ...report.scenarios.map((scenario) => scenario.scenarioName.length),
    );
    const kindWidth = Math.max("Kind".length, ...report.scenarios.map((scenario) => scenario.scenarioKind.length));

    const header = [
        padRight("Scenario", scenarioWidth),
        padRight("Kind", kindWidth),
        padRight("Status", 8),
        padRight("Fees (nano)", 14),
        padRight("Fees (TON)", 14),
        padRight("Gas", 14),
        padRight("Exit", 8),
    ].join(" | ");

    console.log(`Gas profile for ${report.contractName}`);
    console.log(`Generated at ${report.generatedAt}`);
    console.log(`Scenarios: ${report.inputFiles.scenariosPath}`);
    console.log("");
    console.log(header);
    console.log("-".repeat(header.length));

    for (const scenario of report.scenarios) {
        const exitCode = scenario.metrics.find((metric) => metric.exitCode !== null)?.exitCode ?? null;
        console.log(
            [
                padRight(scenario.scenarioName, scenarioWidth),
                padRight(scenario.scenarioKind, kindWidth),
                padRight(scenario.summary.success ? "ok" : "failed", 8),
                padRight(formatNullableBigint(scenario.summary.totalFees), 14),
                padRight(formatNanotonsAsTon(scenario.summary.totalFees), 14),
                padRight(formatNullableBigint(scenario.summary.totalGasUsed), 14),
                padRight(exitCode === null ? "n/a" : String(exitCode), 8),
            ].join(" | "),
        );
    }

    console.log("");
    console.log(
        `Overall: ${report.overall.successfulScenarios}/${report.overall.totalScenarios} successful, ${report.overall.failedScenarios} failed.`,
    );
}

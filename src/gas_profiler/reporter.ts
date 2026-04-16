import fs from "node:fs";
import path from "node:path";
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

export function buildMarkdownReport(report: GasProfileReport): string {
    const lines: string[] = [];

    lines.push(`# Gas Profile Report: ${report.contractName}`);
    lines.push("");
    lines.push("## Inputs");
    lines.push("");
    lines.push(`- Generated at: \`${report.generatedAt}\``);
    lines.push(`- Contract: \`${report.inputFiles.contractPath}\``);
    lines.push(`- Scenarios: \`${report.inputFiles.scenariosPath}\``);
    if (report.inputFiles.buildPath) {
        lines.push(`- Build: \`${report.inputFiles.buildPath}\``);
    }
    if (report.inputFiles.wrapperPath) {
        lines.push(`- Wrapper: \`${report.inputFiles.wrapperPath}\``);
    }
    lines.push("");

    if (report.description) {
        lines.push("## Description");
        lines.push("");
        lines.push(report.description);
        lines.push("");
    }

    if (report.staticAnalysis) {
        lines.push("## Static Analysis Findings");
        lines.push("");
        lines.push(`- Total findings: ${report.staticAnalysis.summary.totalFindings}`);
        lines.push("");

        if (report.staticAnalysis.findings.length === 0) {
            lines.push("No findings.");
            lines.push("");
        } else {
            lines.push("| Severity | Line | Rule | Title |");
            lines.push("|---|---:|---|---|");

            for (const finding of report.staticAnalysis.findings) {
                lines.push(
                    `| ${finding.severity} | ${finding.line ?? "n/a"} | ${escapeMarkdownCell(finding.ruleId)} | ${escapeMarkdownCell(finding.title)} |`,
                );
            }
            lines.push("");

            for (const finding of report.staticAnalysis.findings) {
                lines.push(`### ${finding.severity}: ${finding.title}`);
                lines.push("");
                lines.push(`- Rule: \`${finding.ruleId}\``);
                lines.push(`- Line: ${finding.line ?? "n/a"}`);
                lines.push(`- Message: ${finding.message}`);
                if (finding.evidence) {
                    lines.push(`- Evidence: ${finding.evidence}`);
                }
                if (finding.recommendation) {
                    lines.push(`- Recommendation: ${finding.recommendation}`);
                }
                lines.push("");
            }
        }
    }

    lines.push("## Gas Profiling Summary");
    lines.push("");
    lines.push("| Scenario | Kind | Status | Fees (nano) | Fees (TON) | Gas | Exit |");
    lines.push("|---|---|---:|---:|---:|---:|---:|");

    for (const scenario of report.scenarios) {
        const exitCode = scenario.metrics.find((metric) => metric.exitCode !== null)?.exitCode ?? null;
        lines.push(
            `| ${escapeMarkdownCell(scenario.scenarioName)} | ${scenario.scenarioKind} | ${scenario.summary.success ? "ok" : "failed"} | ${formatNullableBigint(scenario.summary.totalFees)} | ${formatNanotonsAsTon(scenario.summary.totalFees)} | ${formatNullableBigint(scenario.summary.totalGasUsed)} | ${exitCode === null ? "n/a" : String(exitCode)} |`,
        );
    }

    lines.push("");
    lines.push("## Overall");
    lines.push("");
    lines.push(`- Total scenarios: ${report.overall.totalScenarios}`);
    lines.push(`- Successful scenarios: ${report.overall.successfulScenarios}`);
    lines.push(`- Failed scenarios: ${report.overall.failedScenarios}`);

    return `${lines.join("\n")}\n`;
}

export function getMarkdownReportPath(outputPath: string): string {
    const extension = path.extname(outputPath);
    if (!extension) {
        return `${outputPath}.md`;
    }

    return `${outputPath.slice(0, -extension.length)}.md`;
}

export function saveGasProfileMarkdownReport(report: GasProfileReport, outputPath: string): string {
    const markdownPath = getMarkdownReportPath(outputPath);
    ensureDirectoryForFile(markdownPath);
    fs.writeFileSync(markdownPath, buildMarkdownReport(report), "utf-8");
    return markdownPath;
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

function escapeMarkdownCell(value: string): string {
    return value.replace(/\|/g, "\\|");
}

import test from "node:test";
import assert from "node:assert/strict";
import { buildMarkdownReport, getMarkdownReportPath } from "../../src/gas_profiler/reporter";
import type { GasProfileReport } from "../../src/gas_profiler/types";

test("getMarkdownReportPath replaces extension with md", () => {
    assert.equal(getMarkdownReportPath("/tmp/report.json"), "/tmp/report.md");
    assert.equal(getMarkdownReportPath("/tmp/report"), "/tmp/report.md");
});

test("buildMarkdownReport renders a markdown table", () => {
    const report: GasProfileReport = {
        contractName: "DemoContract",
        generatedAt: "2026-04-15T00:00:00.000Z",
        inputFiles: {
            contractPath: "/tmp/Demo.tact",
            scenariosPath: "/tmp/demo.scenarios.json",
        },
        staticAnalysis: {
            findings: [
                {
                    ruleId: "empty-function",
                    severity: "LOW",
                    title: "Empty executable declaration",
                    message: "Empty receive block.",
                    line: 12,
                },
            ],
            summary: {
                totalFindings: 1,
            },
        },
        scenarios: [
            {
                scenarioName: "deploy",
                scenarioKind: "deploy",
                metrics: [],
                summary: {
                    totalGasUsed: 2563n,
                    totalFees: 1025200n,
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

    const markdown = buildMarkdownReport(report);
    assert.match(markdown, /# Gas Profile Report: DemoContract/);
    assert.match(markdown, /## Static Analysis Findings/);
    assert.match(markdown, /\| LOW \| 12 \| empty-function \| Empty executable declaration \|/);
    assert.match(markdown, /\| Scenario \| Kind \| Status \| Fees \(nano\) \| Fees \(TON\) \| Gas \| Exit \|/);
    assert.match(markdown, /\| deploy \| deploy \| ok \| 1025200 \| 0\.0010252 \| 2563 \| n\/a \|/);
});

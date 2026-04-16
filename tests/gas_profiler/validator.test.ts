import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { parseGasProfilerCliArgs, resolveGasProfilerInput } from "../../src/gas_profiler/input";
import { validateScenarioFile } from "../../src/gas_profiler/validator";

test("validateScenarioFile rejects missing getter methodName", () => {
    assert.throws(
        () =>
            validateScenarioFile(
                {
                    scenarios: [{ name: "broken getter", kind: "getter" }],
                },
                "broken.json",
            ),
        /methodName обязателен/,
    );
});

test("validateScenarioFile rejects missing text for receive-text", () => {
    assert.throws(
        () =>
            validateScenarioFile(
                {
                    scenarios: [{ name: "broken text", kind: "receive-text" }],
                },
                "broken.json",
            ),
        /text обязателен/,
    );
});

test("parseGasProfilerCliArgs parses supported options", () => {
    const parsed = parseGasProfilerCliArgs([
        "--contract",
        "./contracts/MyContract.tact",
        "--scenarios",
        "./scenarios.json",
        "--format",
        "json",
    ]);

    assert.equal(parsed.contractPath, "./contracts/MyContract.tact");
    assert.equal(parsed.scenariosPath, "./scenarios.json");
    assert.equal(parsed.format, "json");
});

test("resolveGasProfilerInput normalizes paths and resolves wrapper from build", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "gas-profiler-"));
    const contractPath = path.join(tempRoot, "Demo.tact");
    const buildPath = path.join(tempRoot, "build");
    const scenariosPath = path.join(tempRoot, "demo.scenarios.json");
    const wrapperPath = path.join(buildPath, "demo_DemoContract.ts");

    fs.writeFileSync(contractPath, "contract Demo {}", "utf-8");
    fs.mkdirSync(buildPath, { recursive: true });
    fs.writeFileSync(
        wrapperPath,
        [
            "class DemoContract {",
            "  static async fromInit() { return { address: { toString() { return 'addr'; } }, init: null }; }",
            "}",
            "module.exports = { DemoContract };",
            "",
        ].join("\n"),
        "utf-8",
    );
    fs.writeFileSync(
        scenariosPath,
        JSON.stringify({
            contractName: "DemoContract",
            scenarios: [{ name: "deploy", kind: "deploy" }],
        }),
        "utf-8",
    );

    const resolved = resolveGasProfilerInput({
        contractPath,
        scenariosPath,
        buildPath,
        format: "pretty",
    });

    assert.equal(resolved.inputFiles.wrapperPath, wrapperPath);
    assert.equal(resolved.outputPath, path.join(process.cwd(), "reports", "gas-profile-report.json"));
    assert.equal(resolved.wrapperExportName, "DemoContract");
});

test("resolveGasProfilerInput reports invalid scenario JSON", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "gas-profiler-json-"));
    const contractPath = path.join(tempRoot, "Demo.tact");
    const scenariosPath = path.join(tempRoot, "broken.json");

    fs.writeFileSync(contractPath, "contract Demo {}", "utf-8");
    fs.writeFileSync(scenariosPath, "{ invalid", "utf-8");

    assert.throws(
        () =>
            resolveGasProfilerInput({
                contractPath,
                scenariosPath,
                buildPath: tempRoot,
                format: "pretty",
            }),
        /Некорректный JSON/,
    );
});

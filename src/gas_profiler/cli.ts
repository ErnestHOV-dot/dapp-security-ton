import { printRootHelp } from "../cli";
import { analyzeContractFile } from "../linter";
import { createRules } from "../rules";
import { RED, RESET } from "../utils";
import { parseGasProfilerCliArgs, resolveGasProfilerInput } from "./input";
import {
    printGasProfileReport,
    saveGasProfileMarkdownReport,
    saveGasProfileReport,
    toJsonReport,
} from "./reporter";
import { runGasProfiler } from "./runner";

export async function runGasProfilerCli(argv: string[]): Promise<void> {
    if (argv.includes("--help") || argv.includes("-h")) {
        printRootHelp();
        return;
    }

    try {
        const cliOptions = parseGasProfilerCliArgs(argv);
        const input = resolveGasProfilerInput(cliOptions);
        const report = await runGasProfiler({ input });
        const analysis = analyzeContractFile(input.inputFiles.contractPath, createRules());
        report.staticAnalysis = {
            findings: analysis.issues,
            summary: {
                totalFindings: analysis.issues.length,
            },
        };

        saveGasProfileReport(report, input.outputPath);
        const markdownPath = saveGasProfileMarkdownReport(report, input.outputPath);
        if (input.options.format === "json") {
            console.log(JSON.stringify(toJsonReport(report), null, 2));
        } else {
            printGasProfileReport(report);
        }
        console.log(`JSON report saved to ${input.outputPath}`);
        console.log(`Markdown report saved to ${markdownPath}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${RED}Gas profiler error:${RESET} ${message}`);
        process.exitCode = 1;
    }
}

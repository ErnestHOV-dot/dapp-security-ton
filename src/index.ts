import path from "node:path";
import { parseRootCliArgs, printRootHelp } from "./cli";
import { runGasProfilerCli } from "./gas_profiler/cli";
import { runLinter } from "./linter";
import { createRules } from "./rules";

async function main() {
    const cli = parseRootCliArgs(process.argv.slice(2));

    if (cli.help) {
        printRootHelp();
        return;
    }

    if (cli.gasProfile) {
        await runGasProfilerCli(cli.remainingArgs.filter((entry) => entry !== "--gas-profile"));
        return;
    }

    if (!cli.contractPath) {
        printRootHelp();
        process.exitCode = 1;
        return;
    }

    const filename = path.resolve(process.cwd(), cli.contractPath);
    await runLinter(filename, createRules());
}

void main();

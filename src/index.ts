import path from "node:path";
import { parseRootCliArgs, printRootHelp } from "./cli";
import { runGasProfilerCli } from "./gas_profiler/cli";
import { runLinter } from "./linter";
import { createRules } from "./rules";

const DEFAULT_FILENAME = "./contracts/GasTestContract.tact";

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

    const filename = path.resolve(process.cwd(), cli.contractPath ?? DEFAULT_FILENAME);
    await runLinter(filename, createRules());
}

void main();

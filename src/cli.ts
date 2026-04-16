export interface RootCliOptions {
    gasProfile: boolean;
    help: boolean;
    contractPath?: string;
    remainingArgs: string[];
}

export function parseRootCliArgs(argv: string[]): RootCliOptions {
    const remainingArgs: string[] = [];
    let gasProfile = false;
    let help = false;
    let contractPath: string | undefined;

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (current === "--gas-profile") {
            gasProfile = true;
            continue;
        }

        if (current === "--help" || current === "-h") {
            help = true;
            continue;
        }

        if (current === "--contract") {
            const value = argv[index + 1];
            if (!value) {
                throw new Error("Аргумент --contract требует значение.");
            }
            contractPath = value;
            remainingArgs.push(current, value);
            index += 1;
            continue;
        }

        if (!current.startsWith("-") && !contractPath) {
            contractPath = current;
        }

        remainingArgs.push(current);
    }

    return {
        gasProfile,
        help,
        contractPath,
        remainingArgs,
    };
}

export function printRootHelp(): void {
    console.log("Usage:");
    console.log("  npm run analyze -- <contract.tact>");
    console.log("  npm run analyze -- --gas-profile --contract <path> --scenarios <path> [options]");
    console.log("  npm run gas:profile -- --contract <path> --scenarios <path> [options]");
    console.log("");
    console.log("Gas profiler options:");
    console.log("  --contract <path>   путь к .tact файлу или директории проекта");
    console.log("  --scenarios <path>  путь к JSON-файлу сценариев");
    console.log("  --build <path>      путь к build-артефактам");
    console.log("  --wrapper <path>    путь к generated wrapper");
    console.log("  --output <path>     путь для сохранения JSON-отчета");
    console.log("  --format <json|pretty>");
}

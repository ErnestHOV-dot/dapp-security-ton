import fs from "node:fs";
import path from "node:path";
import { loadJsonFile, loadModule, findUp, runTactBuild } from "./utils";
import { validateProfilerCliOptions, validateScenarioFile } from "./validator";
import type { GasProfilerCliOptions, GasScenarioFile, ResolvedGasProfilerInput } from "./types";

interface TactConfigProject {
    name: string;
    path: string;
    output: string;
}

interface TactConfigFile {
    projects: TactConfigProject[];
}

export function parseGasProfilerCliArgs(argv: string[]): GasProfilerCliOptions {
    const options: GasProfilerCliOptions = {
        format: "pretty",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        switch (current) {
            case "--contract":
                options.contractPath = requireValue(argv, ++index, current);
                break;
            case "--scenarios":
                options.scenariosPath = requireValue(argv, ++index, current);
                break;
            case "--build":
                options.buildPath = requireValue(argv, ++index, current);
                break;
            case "--wrapper":
                options.wrapperPath = requireValue(argv, ++index, current);
                break;
            case "--output":
                options.outputPath = requireValue(argv, ++index, current);
                break;
            case "--format": {
                const format = requireValue(argv, ++index, current);
                if (format !== "json" && format !== "pretty") {
                    throw new Error(`Неподдерживаемый формат '${format}'. Ожидается json или pretty.`);
                }
                options.format = format;
                break;
            }
            default:
                throw new Error(`Неизвестный аргумент '${current}' для gas profiler.`);
        }
    }

    return options;
}

export function resolveGasProfilerInput(
    options: GasProfilerCliOptions,
    cwd = process.cwd(),
): ResolvedGasProfilerInput {
    const normalizedOptions: GasProfilerCliOptions = {
        ...options,
        contractPath: options.contractPath ? path.resolve(cwd, options.contractPath) : undefined,
        scenariosPath: options.scenariosPath ? path.resolve(cwd, options.scenariosPath) : undefined,
        buildPath: options.buildPath ? path.resolve(cwd, options.buildPath) : undefined,
        wrapperPath: options.wrapperPath ? path.resolve(cwd, options.wrapperPath) : undefined,
        outputPath: options.outputPath
            ? path.resolve(cwd, options.outputPath)
            : path.resolve(cwd, "reports", "gas-profile-report.json"),
    };

    validateProfilerCliOptions(normalizedOptions);

    const scenarioFile = loadAndValidateScenarioFile(normalizedOptions.scenariosPath!);
    const resolution = resolveArtifacts(normalizedOptions.contractPath!, scenarioFile, normalizedOptions);

    return {
        options: normalizedOptions,
        inputFiles: {
            contractPath: normalizedOptions.contractPath!,
            scenariosPath: normalizedOptions.scenariosPath!,
            buildPath: resolution.buildPath,
            wrapperPath: resolution.wrapperPath,
        },
        outputPath: normalizedOptions.outputPath!,
        scenarioFile,
        wrapperExportName: resolution.wrapperExportName,
        wrapperModule: loadModule(resolution.wrapperPath),
    };
}

function loadAndValidateScenarioFile(scenariosPath: string): GasScenarioFile {
    return validateScenarioFile(loadJsonFile<unknown>(scenariosPath), scenariosPath);
}

function resolveArtifacts(
    contractPath: string,
    scenarioFile: GasScenarioFile,
    options: GasProfilerCliOptions,
): {
    buildPath?: string;
    wrapperPath: string;
    wrapperExportName: string;
} {
    if (options.wrapperPath) {
        const wrapperExportName = resolveWrapperExportName(options.wrapperPath, scenarioFile.contractName);
        return {
            buildPath: options.buildPath,
            wrapperPath: options.wrapperPath,
            wrapperExportName,
        };
    }

    const tactConfigResolution = resolveFromTactConfig(contractPath);
    const buildPath = options.buildPath ?? tactConfigResolution?.buildPath;

    if (!buildPath) {
        throw new Error(
            "Не удалось определить путь к build-артефактам. Укажите --build/--wrapper или настройте tact.config.json.",
        );
    }

    let wrapperPath = findWrapperPath(buildPath, scenarioFile.contractName, tactConfigResolution?.projectName);
    if (!wrapperPath && tactConfigResolution?.configPath) {
        runTactBuild(tactConfigResolution.configPath, tactConfigResolution.projectName);
        wrapperPath = findWrapperPath(buildPath, scenarioFile.contractName, tactConfigResolution.projectName);
    }

    if (!wrapperPath) {
        throw new Error(
            `Не удалось найти wrapper в '${buildPath}'. Укажите --wrapper явно или соберите проект через tact.`,
        );
    }

    return {
        buildPath,
        wrapperPath,
        wrapperExportName: resolveWrapperExportName(wrapperPath, scenarioFile.contractName),
    };
}

function resolveFromTactConfig(contractPath: string):
    | {
          configPath: string;
          buildPath: string;
          projectName?: string;
      }
    | undefined {
    const contractStats = fs.statSync(contractPath);
    const configSearchStart = contractStats.isDirectory() ? contractPath : path.dirname(contractPath);
    const configPath = findUp("tact.config.json", configSearchStart) ?? findUp("tact.config.json", process.cwd());

    if (!configPath) {
        return undefined;
    }

    const config = loadJsonFile<TactConfigFile>(configPath);
    if (!Array.isArray(config.projects) || config.projects.length === 0) {
        return undefined;
    }

    const resolvedContractPath = contractStats.isDirectory() ? undefined : path.resolve(contractPath);
    const project = resolvedContractPath
        ? config.projects.find(
              (entry) => path.resolve(path.dirname(configPath), entry.path) === resolvedContractPath,
          )
        : config.projects.length === 1
          ? config.projects[0]
          : undefined;

    if (!project) {
        return undefined;
    }

    return {
        configPath,
        buildPath: path.resolve(path.dirname(configPath), project.output),
        projectName: project.name,
    };
}

function findWrapperPath(
    buildPath: string,
    contractName?: string,
    projectName?: string,
): string | undefined {
    if (!fs.existsSync(buildPath) || !fs.statSync(buildPath).isDirectory()) {
        return undefined;
    }

    const files = fs
        .readdirSync(buildPath)
        .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".js"))
        .sort();

    if (files.length === 0) {
        return undefined;
    }

    const exactByContract = contractName
        ? files.find((entry) => path.basename(entry, path.extname(entry)).endsWith(`_${contractName}`))
        : undefined;
    if (exactByContract) {
        return path.join(buildPath, exactByContract);
    }

    const exactByProject = projectName
        ? files.find((entry) => path.basename(entry, path.extname(entry)).startsWith(`${projectName}_`))
        : undefined;
    if (exactByProject) {
        return path.join(buildPath, exactByProject);
    }

    if (files.length === 1) {
        return path.join(buildPath, files[0]);
    }

    return undefined;
}

function resolveWrapperExportName(wrapperPath: string, contractName?: string): string {
    const moduleExports = loadModule(wrapperPath);

    if (contractName && isWrapperContractExport(moduleExports[contractName])) {
        return contractName;
    }

    const candidate = Object.entries(moduleExports).find(([, value]) => isWrapperContractExport(value));
    if (!candidate) {
        throw new Error(`В wrapper-файле '${wrapperPath}' не найден Tact contract export.`);
    }

    return candidate[0];
}

function isWrapperContractExport(value: unknown): boolean {
    if (!value || typeof value !== "function") {
        return false;
    }

    const record = value as unknown as Record<string, unknown>;
    return typeof record.fromInit === "function" || typeof record.fromAddress === "function";
}

function requireValue(argv: string[], index: number, optionName: string): string {
    const value = argv[index];
    if (!value) {
        throw new Error(`Аргумент ${optionName} требует значение.`);
    }

    return value;
}

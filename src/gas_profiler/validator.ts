import fs from "node:fs";
import path from "node:path";
import { isSupportedScenarioKind } from "./scenario.schema";
import type { GasProfilerCliOptions, GasScenario, GasScenarioFile } from "./types";

export function validateProfilerCliOptions(options: GasProfilerCliOptions): void {
    if (!options.scenariosPath) {
        throw new Error("Не указан путь к JSON-файлу сценариев. Используйте --scenarios <path>.");
    }

    if (!options.contractPath) {
        throw new Error("Не указан путь к Tact-контракту или проекту. Используйте --contract <path>.");
    }

    validateExistingPath(options.contractPath, "--contract");
    validateExistingPath(options.scenariosPath, "--scenarios");

    if (options.buildPath) {
        validateExistingPath(options.buildPath, "--build");
    }

    if (options.wrapperPath) {
        validateExistingPath(options.wrapperPath, "--wrapper");
    }
}

export function validateScenarioFile(raw: unknown, scenariosPath: string): GasScenarioFile {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Файл сценариев '${scenariosPath}' должен содержать JSON-объект.`);
    }

    const candidate = raw as Record<string, unknown>;
    if (!Array.isArray(candidate.scenarios) || candidate.scenarios.length === 0) {
        throw new Error(`Файл сценариев '${scenariosPath}' должен содержать непустой массив 'scenarios'.`);
    }

    const scenarios = candidate.scenarios.map((scenario, index) =>
        validateScenario(scenario, `${scenariosPath}:scenarios[${index}]`),
    );

    if (candidate.defaults !== undefined && (!candidate.defaults || typeof candidate.defaults !== "object")) {
        throw new Error(`Поле 'defaults' в '${scenariosPath}' должно быть объектом.`);
    }

    return {
        contractName: optionalString(candidate.contractName, "contractName", scenariosPath),
        description: optionalString(candidate.description, "description", scenariosPath),
        defaults: candidate.defaults as GasScenarioFile["defaults"],
        scenarios,
    };
}

function validateScenario(raw: unknown, label: string): GasScenario {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`${label} должен быть объектом.`);
    }

    const scenario = raw as Record<string, unknown>;
    const name = requireString(scenario.name, `${label}.name`);
    const kind = requireString(scenario.kind, `${label}.kind`);

    if (!isSupportedScenarioKind(kind)) {
        throw new Error(`${label}.kind имеет неподдерживаемое значение '${kind}'.`);
    }

    if (kind === "getter" && typeof scenario.methodName !== "string") {
        throw new Error(`${label}.methodName обязателен для getter-сценария.`);
    }

    if (kind === "receive-text" && typeof scenario.text !== "string") {
        throw new Error(`${label}.text обязателен для receive-text сценария.`);
    }

    if (kind === "receive-typed" && (!scenario.typedMessage || typeof scenario.typedMessage !== "object")) {
        throw new Error(`${label}.typedMessage обязателен для receive-typed сценария.`);
    }

    return {
        name,
        kind,
        methodName: optionalString(scenario.methodName, "methodName", label),
        args: scenario.args as unknown[] | undefined,
        text: optionalString(scenario.text, "text", label),
        value: optionalString(scenario.value, "value", label),
        senderName: optionalString(scenario.senderName, "senderName", label),
        typedMessage: scenario.typedMessage as Record<string, unknown> | undefined,
        note: optionalString(scenario.note, "note", label),
    };
}

function validateExistingPath(targetPath: string, optionName: string): void {
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Путь '${targetPath}' из ${optionName} не существует.`);
    }
}

function requireString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Поле '${fieldName}' должно быть непустой строкой.`);
    }

    return value;
}

function optionalString(value: unknown, fieldName: string, label: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new Error(`Поле '${fieldName}' в '${path.basename(label)}' должно быть строкой.`);
    }

    return value;
}

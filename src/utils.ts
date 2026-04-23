import type { FieldMutationSummary, Issue, Severity } from "./types";

export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
export const BLUE = "\x1b[34m";
export const RESET = "\x1b[0m";

export function compareIssues(left: Issue, right: Issue): number {
    const leftLine = left.line ?? Number.MAX_SAFE_INTEGER;
    const rightLine = right.line ?? Number.MAX_SAFE_INTEGER;

    if (leftLine !== rightLine) {
        return leftLine - rightLine;
    }

    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    if (severityDiff !== 0) {
        return severityDiff;
    }

    return (
        left.ruleId.localeCompare(right.ruleId) ||
        left.title.localeCompare(right.title) ||
        left.message.localeCompare(right.message)
    );
}

export function severityRank(severity: Severity): number {
    switch (severity) {
        case "CRITICAL":
            return 5;
        case "HIGH":
            return 4;
        case "MEDIUM":
            return 3;
        case "LOW":
            return 2;
        case "INFO":
            return 1;
    }
}

export function visitExecutableDeclarations(
    ast: any,
    visitor: (decl: any, contractName?: string) => void,
) {
    for (const entry of ast.items ?? []) {
        if (entry.kind !== "contract" && entry.kind !== "trait") {
            continue;
        }

        const contractName = entry.name?.text;
        for (const decl of entry.declarations ?? []) {
            if (["receiver", "function_def", "contract_init"].includes(decl.kind)) {
                visitor(decl, contractName);
            }
        }
    }
}

export function traverseStatements(statements: any[], visitor: (statement: any) => void) {
    for (const statement of statements ?? []) {
        visitor(statement);

        if (statement.kind === "statement_condition") {
            traverseStatements(statement.trueStatements ?? [], visitor);
            traverseStatements(statement.falseStatements ?? [], visitor);
        }

        if (
            statement.kind === "statement_while" ||
            statement.kind === "statement_repeat" ||
            statement.kind === "statement_until" ||
            statement.kind === "statement_foreach"
        ) {
            traverseStatements(statement.statements ?? [], visitor);
        }
    }
}

export function traverseAst(node: any, visitor: (node: any) => void) {
    if (node === null || node === undefined) {
        return;
    }

    if (Array.isArray(node)) {
        for (const item of node) {
            traverseAst(item, visitor);
        }
        return;
    }

    if (typeof node !== "object") {
        return;
    }

    visitor(node);

    for (const value of Object.values(node)) {
        traverseAst(value, visitor);
    }
}

export function containsPattern(nodes: any[], patterns: string[]): boolean {
    return nodes.some((node) => {
        const json = safeJsonStringify(node);
        return patterns.some((pattern) => json.includes(pattern));
    });
}

export function countStaticCalls(statements: any[], functionName: string): number {
    let count = 0;

    traverseStatements(statements ?? [], (statement) => {
        if (
            statement.kind === "statement_expression" &&
            statement.expression?.kind === "static_call" &&
            statement.expression.function?.text === functionName
        ) {
            count += 1;
        }
    });

    return count;
}

export function collectSelfArithmeticMutations(sourceCode: string): Map<string, FieldMutationSummary> {
    const result = new Map<string, FieldMutationSummary>();
    const lines = sourceCode.split("\n");

    lines.forEach((line, index) => {
        const compoundMatch = line.match(/self\.(\w+)\s*([+\-*/])=\s*/);
        const mirroredMatch = line.match(/self\.(\w+)\s*=\s*self\.\1\s*([+\-*/])/);
        const match = compoundMatch ?? mirroredMatch;

        if (!match) {
            return;
        }

        const [, field, operation] = match;
        const existing = result.get(field) ?? {
            operations: new Set<string>(),
            line: index + 1,
            samples: [],
        };

        existing.operations.add(operation);
        if (existing.samples.length < 3) {
            existing.samples.push(line.trim());
        }
        result.set(field, existing);
    });

    return result;
}

export function getDeclarationLabel(decl: any): string {
    if (decl.kind === "function_def") {
        return decl.name.text;
    }

    if (decl.kind === "contract_init") {
        return "init";
    }

    if (decl.kind === "receiver") {
        if (decl.selector.kind === "bounce") {
            return "receive(bounce)";
        }

        const sub = decl.selector.subKind;
        if (sub.kind === "comment") {
            return `receive("${sub.comment.value}")`;
        }

        if (sub.kind === "fallback") {
            return "receive(fallback)";
        }

        return "receive(simple)";
    }

    return "unknown";
}

export function getLineFromLoc(loc: any): number | undefined {
    if (loc?.interval?.start && typeof loc.interval.start.line === "number") {
        return loc.interval.start.line;
    }

    if (typeof loc?.line === "number") {
        return loc.line;
    }

    return undefined;
}

export function getDeclarationLine(sourceCode: string, decl: any): number | undefined {
    const fromLoc = getLineFromLoc(decl?.loc);
    if (fromLoc !== undefined) {
        return fromLoc;
    }

    const patterns = getDeclarationPatterns(decl);
    return findFirstMatchingLine(sourceCode, patterns);
}

export function getStatementLine(
    sourceCode: string,
    statement: any,
    minLine = 1,
): number | undefined {
    const fromLoc = getLineFromLoc(statement?.loc);
    if (fromLoc !== undefined) {
        return fromLoc;
    }

    const patterns = getStatementPatterns(statement);
    return findFirstMatchingLine(sourceCode, patterns, minLine);
}

function getDeclarationPatterns(decl: any): string[] {
    if (decl.kind === "contract_init") {
        return ["init()"];
    }

    if (decl.kind === "function_def") {
        const name = decl.name?.text;
        return name ? [`${name}(`, `fun ${name}(`] : [];
    }

    if (decl.kind === "receiver") {
        if (decl.selector?.kind === "external") {
            const comment = decl.selector?.subKind?.comment?.value;
            return comment ? [`external("${comment}")`] : ["external("];
        }

        if (decl.selector?.kind === "bounce") {
            return ["bounced("];
        }

        const subKind = decl.selector?.subKind;
        if (subKind?.kind === "comment") {
            return [`receive("${subKind.comment.value}")`];
        }

        if (subKind?.kind === "fallback") {
            return ["receive()"];
        }

        return ["receive("];
    }

    return [];
}

function getStatementPatterns(statement: any): string[] {
    if (statement.kind === "statement_expression") {
        const expression = statement.expression;
        if (expression?.kind === "static_call") {
            const functionName = expression.function?.text;
            if (functionName) {
                return [`${functionName}(`];
            }
        }
    }

    if (statement.kind === "statement_while") {
        return ["while ("];
    }

    if (statement.kind === "statement_until") {
        return ["until ("];
    }

    if (statement.kind === "statement_repeat") {
        return ["repeat ("];
    }

    return [];
}

function findFirstMatchingLine(
    sourceCode: string,
    patterns: string[],
    minLine = 1,
): number | undefined {
    if (patterns.length === 0) {
        return undefined;
    }

    const lines = sourceCode.split("\n");
    for (let index = Math.max(minLine - 1, 0); index < lines.length; index += 1) {
        const line = lines[index];
        if (patterns.some((pattern) => line.includes(pattern))) {
            return index + 1;
        }
    }

    return undefined;
}

export function safeJsonStringify(obj: any): string {
    return JSON.stringify(obj, (_key, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }

        return value;
    });
}

export function formatContractSuffix(contractName?: string): string {
    return contractName ? ` в '${contractName}'` : "";
}

export function getSeverityColor(severity: Severity): string {
    if (severity === "CRITICAL" || severity === "HIGH") {
        return RED;
    }

    if (severity === "MEDIUM" || severity === "LOW") {
        return YELLOW;
    }

    return CYAN;
}

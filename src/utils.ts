import type { FieldMutationSummary, Issue, Severity } from "./types";

export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
export const BLUE = "\x1b[34m";
export const RESET = "\x1b[0m";

export function compareIssues(left: Issue, right: Issue): number {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    if (severityDiff !== 0) {
        return severityDiff;
    }

    const leftLine = left.line ?? Number.MAX_SAFE_INTEGER;
    const rightLine = right.line ?? Number.MAX_SAFE_INTEGER;

    if (leftLine !== rightLine) {
        return leftLine - rightLine;
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
    return astContainsAnyIdentifier(nodes, patterns);
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

export function getStaticCallName(node: any): string | undefined {
    return node?.kind === "static_call" ? node.function?.text : undefined;
}

export function getMethodCallName(node: any): string | undefined {
    return node?.kind === "method_call" ? node.method?.text : undefined;
}

export function astContainsStaticCall(node: any, functionNames: string[]): boolean {
    const names = new Set(functionNames);
    let found = false;

    traverseAst(node, (current) => {
        if (names.has(getStaticCallName(current) ?? "")) {
            found = true;
        }
    });

    return found;
}

export function astContainsAnyIdentifier(node: any, identifiers: string[]): boolean {
    const names = new Set(identifiers);
    let found = false;

    traverseAst(node, (current) => {
        if (current?.kind === "id" && names.has(current.text)) {
            found = true;
        }
    });

    return found;
}

export function astContainsIdentifierMatching(node: any, predicate: (identifier: string) => boolean): boolean {
    let found = false;

    traverseAst(node, (current) => {
        if (current?.kind === "id" && predicate(current.text)) {
            found = true;
        }
    });

    return found;
}

export function getFieldAccessName(node: any): string | undefined {
    return node?.kind === "field_access" ? node.field?.text : undefined;
}

export function getFieldAccessRootName(node: any): string | undefined {
    if (!node || typeof node !== "object") {
        return undefined;
    }

    if (node.kind === "id") {
        return node.text;
    }

    if (node.kind === "field_access") {
        return getFieldAccessRootName(node.aggregate);
    }

    return undefined;
}

export function isSelfFieldAccess(node: any, fieldName?: string): boolean {
    if (node?.kind !== "field_access") {
        return false;
    }

    if (getFieldAccessRootName(node) !== "self") {
        return false;
    }

    return fieldName === undefined || getFieldAccessName(node) === fieldName;
}

export function getStructFieldInitializer(structNode: any, fieldName: string): any | undefined {
    if (structNode?.kind !== "struct_instance") {
        return undefined;
    }

    const field = (structNode.args ?? []).find((arg: any) => arg.field?.text === fieldName);
    return field?.initializer;
}

export function getSendParametersArg(sendCall: any): any | undefined {
    if (getStaticCallName(sendCall) !== "send") {
        return undefined;
    }

    return (sendCall.args ?? []).find((arg: any) => arg.kind === "struct_instance" && arg.type?.text === "SendParameters");
}

export function getConstantNumber(node: any): number | undefined {
    if (node?.kind !== "number") {
        return undefined;
    }

    const value = Number(node.value);
    return Number.isFinite(value) ? value : undefined;
}

export function collectSelfArithmeticMutationsFromAst(ast: any): Map<string, FieldMutationSummary> {
    const result = new Map<string, FieldMutationSummary>();

    traverseAst(ast, (node) => {
        let field: string | undefined;
        let operation: string | undefined;

        if (node?.kind === "statement_augmentedassign" && isSelfFieldAccess(node.path)) {
            field = getFieldAccessName(node.path);
            operation = typeof node.op === "string" ? node.op.replace("=", "") : undefined;
        }

        if (node?.kind === "statement_assign" && isSelfFieldAccess(node.path)) {
            const rhs = node.expression;
            if (
                rhs?.kind === "op_binary" &&
                ["+", "-", "*", "/"].includes(rhs.op) &&
                ((isSelfFieldAccess(rhs.left, getFieldAccessName(node.path)) && rhs.right !== undefined) ||
                    (isSelfFieldAccess(rhs.right, getFieldAccessName(node.path)) && rhs.left !== undefined))
            ) {
                field = getFieldAccessName(node.path);
                operation = rhs.op;
            }
        }

        if (!field || !operation) {
            return;
        }

        const existing = result.get(field) ?? {
            operations: new Set<string>(),
            line: getLineFromLoc(node?.loc) ?? 1,
            samples: [],
        };

        existing.operations.add(operation);
        if (existing.samples.length < 3) {
            existing.samples.push(compactAstStringify(node, 120));
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

    if (typeof loc?.interval?.getLineAndColumn === "function") {
        const position = loc.interval.getLineAndColumn();
        if (typeof position?.line === "number") {
            return position.line;
        }

        if (typeof position?.lineNum === "number") {
            return position.lineNum;
        }
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

export function compactAstStringify(obj: any, maxLength = 220): string {
    const raw = JSON.stringify(obj, (key, value) => {
        if (key === "id" || key === "loc") {
            return undefined;
        }

        if (typeof value === "bigint") {
            return value.toString();
        }

        return value;
    });

    if (raw.length <= maxLength) {
        return raw;
    }

    return `${raw.slice(0, Math.max(0, maxLength - 3))}...`;
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

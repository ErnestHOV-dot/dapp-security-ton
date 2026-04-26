// Detects zero-address usage in sends and ineffective zero-address validation checks.
import type { Issue, Rule } from "../types";
import {
    astContainsIdentifierMatching,
    compactAstStringify,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    traverseAst,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

function isZeroAddressLiteral(node: any): boolean {
    return (
        node?.kind === "static_call" &&
        node.function?.text === "address" &&
        typeof node.args?.[0]?.value === "string" &&
        /^-?\d+:0+$/.test(node.args[0].value)
    );
}

function containsZeroLikeName(node: any): boolean {
    return astContainsIdentifierMatching(node, (identifier) => {
        const normalized = identifier.toLowerCase();
        return normalized.includes("zero") || normalized.includes("null") || normalized.includes("empty");
    });
}

function containsGuardCall(statements: any[]): boolean {
    let found = false;

    traverseAst(statements, (node) => {
        if (node?.kind === "static_call" && ["throw", "nativeThrow", "require"].includes(node.function?.text)) {
            found = true;
        }
    });

    return found;
}

function extractSendToInitializer(node: any): any | undefined {
    if (node?.kind !== "static_call" || node.function?.text !== "send") {
        return undefined;
    }

    const firstArg = node.args?.[0];
    if (firstArg?.kind !== "struct_instance") {
        return undefined;
    }

    const toField = (firstArg.args ?? []).find((arg: any) => arg.field?.text === "to");
    return toField?.initializer;
}

export function createZeroAddressRule(): Rule {
    return {
        id: "zero-address",
        title: "Potential zero-address usage",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const label = getDeclarationLabel(decl);
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(decl.statements ?? [], (statement) => {
                    const statementLine = getLineFromLoc(statement?.loc) ?? declarationLine;

                    traverseAst(statement.expression, (node) => {
                        const toInitializer = extractSendToInitializer(node);
                        if (toInitializer && (isZeroAddressLiteral(toInitializer) || containsZeroLikeName(toInitializer))) {
                            issues.push({
                                ruleId: "zero-address",
                                severity: "MEDIUM",
                                title: "send() targets zero-like address",
                                message: `В '${label}'${formatContractSuffix(contractName)} найден вызов 'send()' с нулевым или подозрительным адресом назначения.`,
                                line: getLineFromLoc(node?.loc) ?? statementLine,
                                evidence: compactAstStringify(toInitializer),
                                recommendation: "Отправка на нулевой адрес приводит к безвозвратной потере средств. Добавьте явную проверку получателя перед отправкой.",
                            });
                        }
                    });

                    if (statement.kind !== "statement_condition") {
                        return;
                    }

                    const condition = statement.condition;
                    const isZeroAddressCompare =
                        condition?.kind === "op_binary" &&
                        condition.op === "==" &&
                        (isZeroAddressLiteral(condition.left) || isZeroAddressLiteral(condition.right));

                    if (!isZeroAddressCompare) {
                        return;
                    }

                    if (containsGuardCall(statement.trueStatements ?? []) || containsGuardCall(statement.falseStatements ?? [])) {
                        return;
                    }

                    issues.push({
                        ruleId: "zero-address",
                        severity: "MEDIUM",
                        title: "Zero-address check does not stop execution",
                        message: `В '${label}'${formatContractSuffix(contractName)} проверяется нулевой адрес, но выполнение не прерывается через throw()/require().`,
                        line: getLineFromLoc(statement?.loc) ?? declarationLine,
                        evidence: compactAstStringify(condition),
                        recommendation: "Отправка на нулевой адрес приводит к безвозвратной потере средств. Добавьте явную проверку получателя перед отправкой.",
                    });
                });
            });

            return issues;
        },
    };
}

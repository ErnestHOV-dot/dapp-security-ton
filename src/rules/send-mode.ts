// Detects send() calls that omit an explicit send mode.
import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getStatementLine,
    safeJsonStringify,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

export function createSendModeRule(): Rule {
    return {
        id: "send-mode",
        title: "send() call without explicit mode",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const label = getDeclarationLabel(decl);
                const statements = decl.statements ?? [];
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(statements, (statement) => {
                    if (statement.kind !== "statement_expression") {
                        return;
                    }

                    const expression = statement.expression;
                    if (expression?.kind !== "static_call" || expression.function?.text !== "send") {
                        return;
                    }

                    const argsJson = safeJsonStringify(expression.args);
                    const hasMode =
                        argsJson.includes("mode") ||
                        argsJson.includes("SendRemainingValue") ||
                        argsJson.includes("128");

                    if (!hasMode) {
                        issues.push({
                            ruleId: "send-mode",
                            severity: "MEDIUM",
                            title: "send() call without explicit mode",
                            message: `Найден вызов 'send()' в '${label}'${formatContractSuffix(contractName)} без явного режима.`,
                            line: getStatementLine(ctx.sourceCode, statement, declarationLine),
                            evidence: argsJson,
                            recommendation: "Укажите mode, например SendRemainingValue + SendIgnoreErrors, если это соответствует логике.",
                        });
                    }
                });
            });

            return issues;
        },
    };
}

// Detects send() calls that omit an explicit send mode.
import type { Issue, Rule } from "../types";
import {
    astContainsAnyIdentifier,
    compactAstStringify,
    formatContractSuffix,
    getConstantNumber,
    getDeclarationLabel,
    getDeclarationLine,
    getSendParametersArg,
    getStatementLine,
    getStaticCallName,
    getStructFieldInitializer,
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
                    if (getStaticCallName(expression) !== "send") {
                        return;
                    }

                    const sendParams = getSendParametersArg(expression);
                    const modeInitializer = getStructFieldInitializer(sendParams, "mode");
                    const hasMode =
                        modeInitializer !== undefined ||
                        astContainsAnyIdentifier(expression.args, ["SendRemainingValue"]) ||
                        getConstantNumber(modeInitializer) === 128;

                    if (!hasMode) {
                        issues.push({
                            ruleId: "send-mode",
                            severity: "MEDIUM",
                            title: "send() call without explicit mode",
                            message: `Найден вызов 'send()' в '${label}'${formatContractSuffix(contractName)} без явного режима.`,
                            line: getStatementLine(ctx.sourceCode, statement, declarationLine),
                            evidence: compactAstStringify(expression.args),
                            recommendation: "Укажите mode, например SendRemainingValue + SendIgnoreErrors, если это соответствует логике.",
                        });
                    }
                });
            });

            return issues;
        },
    };
}

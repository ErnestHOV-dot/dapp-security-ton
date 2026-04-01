import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getStatementLine,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

export function createLoopRule(): Rule {
    return {
        id: "loop-usage",
        title: "Potentially dangerous loop usage",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const label = getDeclarationLabel(decl);
                const statements = decl.statements ?? [];
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(statements, (statement) => {
                    if (statement.kind === "statement_while" || statement.kind === "statement_until") {
                        issues.push({
                            ruleId: "loop-usage",
                            severity: "CRITICAL",
                            title: "Unbounded while/until loop",
                            message: `Найден цикл 'while/until' в '${label}'${formatContractSuffix(contractName)}. Риск Out-of-Gas.`,
                            line: getStatementLine(ctx.sourceCode, statement, declarationLine),
                            recommendation: "Используйте ограниченные циклы или явные лимиты по итерациям.",
                        });
                    }

                    if (statement.kind === "statement_repeat") {
                        issues.push({
                            ruleId: "loop-usage",
                            severity: "MEDIUM",
                            title: "Repeat loop requires bounded iteration count",
                            message: `Найден цикл 'repeat' в '${label}'${formatContractSuffix(contractName)}. Убедитесь, что число повторений ограничено.`,
                            line: getStatementLine(ctx.sourceCode, statement, declarationLine),
                            recommendation: "Проверьте верхнюю границу числа повторений и стоимость выполнения.",
                        });
                    }
                });
            });

            return issues;
        },
    };
}

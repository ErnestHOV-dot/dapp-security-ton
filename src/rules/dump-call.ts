// Detects leftover dump() debug calls inside executable declarations.
import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getStatementLine,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

export function createDumpCallRule(): Rule {
    return {
        id: "dump-call",
        title: "Debug dump() call found",
        severity: "CRITICAL",
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
                    if (expression?.kind === "static_call" && expression.function?.text === "dump") {
                        issues.push({
                            ruleId: "dump-call",
                            severity: "CRITICAL",
                            title: "Debug dump() call found",
                            message: `Забытый 'dump()' в '${label}'${formatContractSuffix(contractName)}.`,
                            line: getStatementLine(ctx.sourceCode, statement, declarationLine),
                            recommendation: "Удалите отладочный вызов перед деплоем.",
                        });
                    }
                });
            });

            return issues;
        },
    };
}

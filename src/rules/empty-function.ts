import type { Issue, Rule } from "../types";
import { formatContractSuffix, getDeclarationLabel, getDeclarationLine, visitExecutableDeclarations } from "../utils";

export function createEmptyFunctionRule(): Rule {
    return {
        id: "empty-function",
        title: "Empty executable declaration",
        severity: "LOW",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                if (decl.statements && decl.statements.length === 0) {
                    const label = getDeclarationLabel(decl);
                    issues.push({
                        ruleId: "empty-function",
                        severity: "LOW",
                        title: "Empty executable declaration",
                        message: `Пустая функция '${label}'${formatContractSuffix(contractName)}. Лишний код увеличивает стоимость деплоя.`,
                        line: getDeclarationLine(ctx.sourceCode, decl),
                        recommendation: "Удалите пустую функцию или реализуйте ожидаемую логику.",
                    });
                }
            });

            return issues;
        },
    };
}

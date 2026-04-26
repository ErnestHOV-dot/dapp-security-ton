// Detects internal receivers that do not perform explicit sender/owner access checks.
import type { Issue, Rule } from "../types";
import {
    astContainsAnyIdentifier,
    astContainsStaticCall,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    visitExecutableDeclarations,
} from "../utils";

export function createAccessControlRule(): Rule {
    return {
        id: "access-control",
        title: "Internal receiver missing explicit access control",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                if (decl.kind !== "receiver" || decl.selector?.kind !== "internal") {
                    return;
                }

                const statements = decl.statements ?? [];
                if (statements.length === 0) {
                    return;
                }

                const hasAuthCheck = statements.some((statement: any) =>
                    astContainsStaticCall(statement, ["require", "nativeThrow"]) &&
                    astContainsAnyIdentifier(statement, ["sender", "owner"]),
                );

                if (!hasAuthCheck) {
                    const label = getDeclarationLabel(decl);
                    issues.push({
                        ruleId: "access-control",
                        severity: "MEDIUM",
                        title: "Internal receiver missing explicit access control",
                        message: `В функции '${label}'${formatContractSuffix(contractName)} не найдено явных проверок доступа.`,
                        line: getDeclarationLine(ctx.sourceCode, decl),
                        evidence: "Не найдено сочетания require/nativeThrow с sender/owner.",
                        recommendation: "Проверьте, что обработчик валидирует sender() или другой источник полномочий.",
                    });
                }
            });

            return issues;
        },
    };
}

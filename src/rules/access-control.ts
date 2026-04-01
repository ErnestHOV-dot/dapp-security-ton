import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    safeJsonStringify,
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

                const hasAuthCheck = statements.some((statement: any) => {
                    const json = safeJsonStringify(statement);
                    const containsGuard = json.includes("require") || json.includes("nativeThrow");
                    const containsActor = json.includes("sender") || json.includes("owner");
                    return containsGuard && containsActor;
                });

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

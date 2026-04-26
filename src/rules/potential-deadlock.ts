// Detects message-coordination patterns that can lead to cross-contract deadlocks.
import type { Issue, Rule } from "../types";
import {
    astContainsIdentifierMatching,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getStaticCallName,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

export function createDeadlockRule(): Rule {
    return {
        id: "potential-deadlock",
        title: "Potential cross-contract deadlock pattern",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                if (decl.kind !== "receiver") {
                    return;
                }

                const statements = decl.statements ?? [];
                if (statements.length === 0) {
                    return;
                }

                let sendCount = 0;
                let conditionCount = 0;

                traverseStatements(statements, (statement) => {
                    if (statement.kind === "statement_condition") {
                        conditionCount += 1;
                    }

                    if (
                        statement.kind === "statement_expression" &&
                        getStaticCallName(statement.expression) === "send"
                    ) {
                        sendCount += 1;
                    }
                });

                const hasCoordinationKeywords = ["confirm", "confirmation", "wait", "waiting", "status", "pending"]
                    .some((keyword) =>
                        astContainsIdentifierMatching(statements, (identifier) =>
                            identifier.toLowerCase().includes(keyword),
                        ),
                    );

                if (sendCount > 0 && conditionCount > 0 && hasCoordinationKeywords) {
                    const label = getDeclarationLabel(decl);
                    issues.push({
                        ruleId: "potential-deadlock",
                        severity: "HIGH",
                        title: "Potential cross-contract deadlock pattern",
                        message: `В '${label}'${formatContractSuffix(contractName)} найден шаблон ожидания подтверждения через сообщения. Возможна взаимная блокировка между контрактами.`,
                        line: getDeclarationLine(ctx.sourceCode, decl),
                        evidence: "Найдены условные переходы по status/pending/confirm и повторные send() вызовы.",
                        recommendation: "Добавьте timeout, явный escape-path или конечный автомат состояний без циклического ожидания подтверждений.",
                    });
                }
            });

            return issues;
        },
    };
}

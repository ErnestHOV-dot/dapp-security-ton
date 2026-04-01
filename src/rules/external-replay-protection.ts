import type { Issue, Rule } from "../types";
import {
    containsPattern,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    visitExecutableDeclarations,
} from "../utils";

export function createExternalReplayProtectionRule(): Rule {
    return {
        id: "external-replay-protection",
        title: "External receiver without replay protection",
        severity: "CRITICAL",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                if (decl.kind !== "receiver" || decl.selector?.kind !== "external") {
                    return;
                }

                const hasProtection = containsPattern(
                    decl.statements ?? [],
                    ["seqno", "msg_seqno", "timestamp", "now"],
                );

                if (!hasProtection) {
                    const label = getDeclarationLabel(decl);
                    issues.push({
                        ruleId: "external-replay-protection",
                        severity: "CRITICAL",
                        title: "External receiver without replay protection",
                        message: `External сообщение '${label}'${formatContractSuffix(contractName)} без защиты от Replay Attack.`,
                        line: getDeclarationLine(ctx.sourceCode, decl),
                        evidence: "Не найдено упоминаний seqno, msg_seqno, timestamp или now.",
                        recommendation: "Добавьте проверку seqno или timestamp перед обработкой сообщения.",
                    });
                }
            });

            return issues;
        },
    };
}

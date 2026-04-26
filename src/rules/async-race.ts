// Detects order-dependent self state mutations after fan-out message sends.
import type { Issue, Rule } from "../types";
import { collectSelfArithmeticMutationsFromAst, countStaticCalls, formatContractSuffix, getDeclarationLabel } from "../utils";

export function createAsyncRaceRule(): Rule {
    return {
        id: "async-race",
        title: "Potential async order-dependent state update",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            for (const entry of ctx.ast.items ?? []) {
                if (entry.kind !== "contract" && entry.kind !== "trait") {
                    continue;
                }

                const mutations = collectSelfArithmeticMutationsFromAst(entry);
                if (mutations.size === 0) {
                    continue;
                }

                const contractName = entry.name?.text;
                const declarations = entry.declarations ?? [];
                let hasFanOut = false;
                let fanOutLabel = "receiver";

                for (const decl of declarations) {
                    if (decl.kind !== "receiver") {
                        continue;
                    }

                    const sendCount = countStaticCalls(decl.statements ?? [], "send");
                    if (sendCount >= 2) {
                        hasFanOut = true;
                        fanOutLabel = getDeclarationLabel(decl);
                        break;
                    }
                }

                if (!hasFanOut) {
                    continue;
                }

                for (const [field, mutation] of mutations.entries()) {
                    if (mutation.operations.size < 2) {
                        continue;
                    }

                    issues.push({
                        ruleId: "async-race",
                        severity: "HIGH",
                        title: "Potential async order-dependent state update",
                        message: `Поле 'self.${field}'${formatContractSuffix(contractName)} обновляется разными операциями после fan-out сообщений из '${fanOutLabel}'. Возможна гонка по порядку доставки ответов.`,
                        line: mutation.line,
                        evidence: mutation.samples.join(" | "),
                        recommendation: "Сериализуйте обработку ответов, вводите phase/nonce и избегайте зависимостей от порядка асинхронных сообщений.",
                    });
                }
            }

            return issues;
        },
    };
}

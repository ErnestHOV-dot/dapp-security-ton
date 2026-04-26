// Detects bounce-sensitive send() usage that lacks adequate bounced message handling.
import type { Issue, Rule } from "../types";
import {
    astContainsAnyIdentifier,
    getDeclarationLine,
    getSendParametersArg,
    getStatementLine,
    getStaticCallName,
    getStructFieldInitializer,
    traverseStatements,
} from "../utils";

export function createBounceHandlingRule(): Rule {
    return {
        id: "bounce-handling",
        title: "Bounce-sensitive send() may be unchecked",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            for (const entry of ctx.ast.items ?? []) {
                if (entry.kind !== "contract" && entry.kind !== "trait") {
                    continue;
                }

                const contractName = entry.name?.text;
                const declarations = entry.declarations ?? [];
                const bounceHandlers = declarations.filter(
                    (decl: any) => decl.kind === "receiver" && decl.selector?.kind === "bounce",
                );

                let bounceSensitiveSendCount = 0;
                let firstOffendingLine: number | undefined;

                for (const decl of declarations) {
                    const declarationLine = getDeclarationLine(ctx.sourceCode, decl);
                    traverseStatements(decl.statements ?? [], (statement) => {
                        if (statement.kind !== "statement_expression" || getStaticCallName(statement.expression) !== "send") {
                            return;
                        }

                        const sendParams = getSendParametersArg(statement.expression);
                        const bounceInitializer = getStructFieldInitializer(sendParams, "bounce");
                        const toInitializer = getStructFieldInitializer(sendParams, "to");
                        const modeInitializer = getStructFieldInitializer(sendParams, "mode");
                        const isBounceSensitive =
                            (bounceInitializer !== undefined &&
                                (bounceInitializer.kind !== "boolean" || bounceInitializer.value !== false)) ||
                            astContainsAnyIdentifier(modeInitializer, ["SendIgnoreErrors"]) ||
                            astContainsAnyIdentifier(toInitializer, ["sender"]);

                        if (isBounceSensitive) {
                            bounceSensitiveSendCount += 1;
                            firstOffendingLine ??= getStatementLine(ctx.sourceCode, statement, declarationLine);
                        }
                    });
                }

                if (bounceSensitiveSendCount === 0) {
                    continue;
                }

                if (bounceHandlers.length === 0) {
                    issues.push({
                        ruleId: "bounce-handling",
                        severity: "HIGH",
                        title: "Bounce-sensitive send() may be unchecked",
                        message: `В '${contractName ?? "contract"}' есть bounce-чувствительные send() вызовы, но нет bounced-обработчика.`,
                        line: firstOffendingLine,
                        evidence: `Обнаружено ${bounceSensitiveSendCount} bounce-чувствительных send() вызов(а/ов).`,
                        recommendation: "Добавьте bounced(...) handler и явно восстанавливайте состояние после неуспешной доставки.",
                    });
                    continue;
                }

                if (bounceSensitiveSendCount > bounceHandlers.length) {
                    issues.push({
                        ruleId: "bounce-handling",
                        severity: "MEDIUM",
                        title: "Bounce handling coverage should be reviewed",
                        message: `В '${contractName ?? "contract"}' исходящих bounce-чувствительных send() больше, чем bounced-обработчиков.`,
                        line: firstOffendingLine,
                        evidence: `${bounceSensitiveSendCount} send() vs ${bounceHandlers.length} bounced handler(s).`,
                        recommendation: "Проверьте, что все важные пути доставки и отката состояния действительно покрыты bounced-логикой.",
                    });
                }
            }

            return issues;
        },
    };
}

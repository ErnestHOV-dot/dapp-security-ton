// Detects outgoing message sends performed from inside loops.
import type { Issue, Rule } from "../types";
import {
    compactAstStringify,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    traverseAst,
    visitExecutableDeclarations,
} from "../utils";

function inspectStatement(
    statement: any,
    insideLoop: boolean,
    ctx: { issues: Issue[]; label: string; contractName?: string; declarationLine?: number },
) {
    const statementLine = getLineFromLoc(statement?.loc) ?? ctx.declarationLine;

    if (insideLoop) {
        for (const rootNode of [statement.expression, statement.condition]) {
            traverseAst(rootNode, (node) => {
                const isSend = node?.kind === "static_call" && node.function?.text === "send";
                const isSelfMethod =
                    node?.kind === "method_call" &&
                    node.self?.kind === "id" &&
                    node.self.text === "self" &&
                    (node.method?.text === "reply" || node.method?.text === "forward");

                if (!isSend && !isSelfMethod) {
                    return;
                }

                const callLabel = isSend ? "send()" : `self.${node.method.text}()`;
                ctx.issues.push({
                    ruleId: "send-in-loop",
                    severity: "MEDIUM",
                    title: "Message send inside loop",
                    message: `В '${ctx.label}'${formatContractSuffix(ctx.contractName)} найден вызов '${callLabel}' внутри цикла.`,
                    line: getLineFromLoc(node?.loc) ?? statementLine,
                    evidence: compactAstStringify(node),
                    recommendation: "Каждый send() в цикле расходует газ и создаёт исходящее сообщение. При большом числе итераций контракт исчерпает газовый лимит. Рассмотрите batch-подход или ограничьте число итераций.",
                });
            });
        }
    }

    if (statement.kind === "statement_condition") {
        for (const nested of statement.trueStatements ?? []) {
            inspectStatement(nested, insideLoop, ctx);
        }

        for (const nested of statement.falseStatements ?? []) {
            inspectStatement(nested, insideLoop, ctx);
        }

        return;
    }

    if (
        statement.kind === "statement_while" ||
        statement.kind === "statement_until" ||
        statement.kind === "statement_repeat" ||
        statement.kind === "statement_foreach"
    ) {
        for (const nested of statement.statements ?? []) {
            inspectStatement(nested, true, ctx);
        }
    }
}

export function createSendInLoopRule(): Rule {
    return {
        id: "send-in-loop",
        title: "Message sending inside loop",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const scope = {
                    issues,
                    label: getDeclarationLabel(decl),
                    contractName,
                    declarationLine: getDeclarationLine(ctx.sourceCode, decl),
                };

                for (const statement of decl.statements ?? []) {
                    inspectStatement(statement, false, scope);
                }
            });

            return issues;
        },
    };
}

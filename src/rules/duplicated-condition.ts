// Detects duplicated if conditions and identical branches that suggest logic mistakes.
import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    visitExecutableDeclarations,
} from "../utils";

function stableNodeStringify(node: any): string {
    return JSON.stringify(node, (key, value) => {
        if (key === "id" || key === "loc") {
            return undefined;
        }

        if (typeof value === "bigint") {
            return value.toString();
        }

        return value;
    });
}

function analyzeScope(
    statements: any[],
    ctx: { issues: Issue[]; label: string; contractName?: string; declarationLine?: number },
) {
    let previousConditionJson: string | undefined;

    for (const statement of statements ?? []) {
        if (statement.kind === "statement_condition") {
            const conditionJson = stableNodeStringify(statement.condition);

            if (previousConditionJson !== undefined && previousConditionJson === conditionJson) {
                ctx.issues.push({
                    ruleId: "duplicated-condition",
                    severity: "HIGH",
                    title: "Duplicated consecutive condition",
                    message: `В '${ctx.label}'${formatContractSuffix(ctx.contractName)} обнаружены соседние if-блоки с одинаковым условием.`,
                    line: getLineFromLoc(statement?.loc) ?? ctx.declarationLine,
                    evidence: conditionJson,
                    recommendation: "Дублирующееся условие указывает на логическую ошибку. Проверьте, что условия различны и покрывают нужные случаи.",
                });
            }

            previousConditionJson = conditionJson;

            const trueJson = stableNodeStringify(statement.trueStatements ?? []);
            const falseJson = stableNodeStringify(statement.falseStatements ?? []);
            if ((statement.falseStatements?.length ?? 0) > 0 && trueJson === falseJson) {
                ctx.issues.push({
                    ruleId: "duplicated-condition",
                    severity: "HIGH",
                    title: "if/else branches are identical",
                    message: `В '${ctx.label}'${formatContractSuffix(ctx.contractName)} ветки if/else выполняют одинаковые действия.`,
                    line: getLineFromLoc(statement?.loc) ?? ctx.declarationLine,
                    evidence: trueJson,
                    recommendation: "Дублирующееся условие указывает на логическую ошибку. Проверьте, что условия различны и покрывают нужные случаи.",
                });
            }

            analyzeScope(statement.trueStatements ?? [], ctx);
            analyzeScope(statement.falseStatements ?? [], ctx);
            continue;
        }

        previousConditionJson = undefined;

        if (
            statement.kind === "statement_while" ||
            statement.kind === "statement_until" ||
            statement.kind === "statement_repeat" ||
            statement.kind === "statement_foreach"
        ) {
            analyzeScope(statement.statements ?? [], ctx);
        }
    }
}

export function createDuplicatedConditionRule(): Rule {
    return {
        id: "duplicated-condition",
        title: "Duplicated conditional logic",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                analyzeScope(decl.statements ?? [], {
                    issues,
                    label: getDeclarationLabel(decl),
                    contractName,
                    declarationLine: getDeclarationLine(ctx.sourceCode, decl),
                });
            });

            return issues;
        },
    };
}

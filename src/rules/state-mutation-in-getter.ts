// Detects get-functions that mutate persistent contract state through self.
import type { Issue, Rule } from "../types";
import {
    compactAstStringify,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

function isSelfMutationPath(path: any): boolean {
    if (!path || typeof path !== "object") {
        return false;
    }

    if (path.kind === "id") {
        return path.text === "self";
    }

    if (path.kind === "field_access") {
        return isSelfMutationPath(path.aggregate);
    }

    return false;
}

export function createStateMutationInGetterRule(): Rule {
    return {
        id: "state-mutation-in-getter",
        title: "Getter mutates contract state",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                if (
                    decl.kind !== "function_def" ||
                    !(decl.attributes ?? []).some((attribute: any) => attribute.type === "get")
                ) {
                    return;
                }

                const label = getDeclarationLabel(decl);
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(decl.statements ?? [], (statement) => {
                    if (statement.kind !== "statement_assign" && statement.kind !== "statement_augmentedassign") {
                        return;
                    }

                    if (!isSelfMutationPath(statement.path)) {
                        return;
                    }

                    issues.push({
                        ruleId: "state-mutation-in-getter",
                        severity: "MEDIUM",
                        title: "Getter changes persistent state",
                        message: `В get-функции '${label}'${formatContractSuffix(contractName)} найдено изменение состояния контракта через 'self'.`,
                        line: getLineFromLoc(statement?.loc) ?? declarationLine,
                        evidence: compactAstStringify(statement.path),
                        recommendation: "Get-функции должны быть чистыми (read-only). Изменение состояния в getter нарушает ожидания вызывающей стороны и может привести к непредвиденному поведению.",
                    });
                });
            });

            return issues;
        },
    };
}

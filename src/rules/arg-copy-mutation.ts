// Detects mutations of struct/message parameters that are passed by value in Tact.
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

const PRIMITIVE_TYPES = new Set(["Int", "Bool", "Address", "String"]);

function getRootIdentifier(path: any): string | undefined {
    if (!path || typeof path !== "object") {
        return undefined;
    }

    if (path.kind === "id") {
        return path.text;
    }

    if (path.kind === "field_access") {
        return getRootIdentifier(path.aggregate);
    }

    return undefined;
}

export function createArgCopyMutationRule(): Rule {
    return {
        id: "arg-copy-mutation",
        title: "Mutation of copied struct or message argument",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const copiedParams = new Set(
                    (decl.params ?? [])
                        .filter((param: any) => {
                            const typeName = param.type?.text;
                            return typeof typeName === "string" && !PRIMITIVE_TYPES.has(typeName);
                        })
                        .map((param: any) => param.name?.text)
                        .filter((name: string | undefined): name is string => Boolean(name)),
                );

                if (copiedParams.size === 0) {
                    return;
                }

                const label = getDeclarationLabel(decl);
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(decl.statements ?? [], (statement) => {
                    if (statement.kind !== "statement_assign" && statement.kind !== "statement_augmentedassign") {
                        return;
                    }

                    if (statement.path?.kind !== "field_access") {
                        return;
                    }

                    const rootIdentifier = getRootIdentifier(statement.path);
                    if (!rootIdentifier || !copiedParams.has(rootIdentifier)) {
                        return;
                    }

                    issues.push({
                        ruleId: "arg-copy-mutation",
                        severity: "HIGH",
                        title: "Mutation of copied argument is lost",
                        message: `В '${label}'${formatContractSuffix(contractName)} мутируется поле аргумента '${rootIdentifier}', который передаётся по значению.`,
                        line: getLineFromLoc(statement?.loc) ?? declarationLine,
                        evidence: compactAstStringify(statement.path),
                        recommendation: "Tact передаёт структуры по значению. Мутация параметра не изменяет оригинал. Верните изменённую копию явно.",
                    });
                });
            });

            return issues;
        },
    };
}

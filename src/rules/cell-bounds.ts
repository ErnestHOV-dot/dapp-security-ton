// Detects builder serialization patterns that can exceed TVM cell bit/ref limits.
import type { Issue, Rule } from "../types";
import {
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    safeJsonStringify,
    traverseAst,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

function getCallName(node: any): string | undefined {
    if (node?.kind === "method_call") {
        return node.method?.text;
    }

    if (node?.kind === "static_call") {
        return node.function?.text;
    }

    return undefined;
}

function getConstantNumber(node: any): number | undefined {
    if (node?.kind !== "number") {
        return undefined;
    }

    const parsed = Number(node.value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function createCellBoundsRule(): Rule {
    return {
        id: "cell-bounds",
        title: "Builder may exceed TVM cell bounds",
        severity: "CRITICAL",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const label = getDeclarationLabel(decl);
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);
                let storeRefCount = 0;
                let firstStoreRefLine: number | undefined;

                traverseStatements(decl.statements ?? [], (statement) => {
                    const statementLine = getLineFromLoc(statement?.loc) ?? declarationLine;
                    const nodesToInspect = [statement.expression, statement.condition];

                    for (const rootNode of nodesToInspect) {
                        traverseAst(rootNode, (node) => {
                            const callName = getCallName(node);
                            if (!callName?.startsWith("store")) {
                                return;
                            }

                            if (callName === "storeRef") {
                                storeRefCount += 1;
                                firstStoreRefLine ??= getLineFromLoc(node?.loc) ?? statementLine;
                            }

                            if ((callName === "storeUint" || callName === "storeInt") && (node.args?.length ?? 0) >= 2) {
                                const bits = getConstantNumber(node.args[1]);
                                if (bits !== undefined && bits > 1023) {
                                    issues.push({
                                        ruleId: "cell-bounds",
                                        severity: "CRITICAL",
                                        title: "Builder stores more than one cell can hold",
                                        message: `Вызов '${callName}' в '${label}'${formatContractSuffix(contractName)} использует ${bits} бит, что превышает лимит TVM-ячейки.`,
                                        line: getLineFromLoc(node?.loc) ?? statementLine,
                                        evidence: safeJsonStringify(node),
                                        recommendation: "Ячейка TVM вмещает не более 1023 бит и 4 ссылок. Разбейте данные на несколько ячеек.",
                                    });
                                }
                            }
                        });
                    }
                });

                if (storeRefCount >= 5) {
                    issues.push({
                        ruleId: "cell-bounds",
                        severity: "CRITICAL",
                        title: "Builder stores too many references",
                        message: `В '${label}'${formatContractSuffix(contractName)} найдено ${storeRefCount} вызовов 'storeRef()', что превышает лимит в 4 ссылки на ячейку TVM.`,
                        line: firstStoreRefLine ?? declarationLine,
                        evidence: `storeRef() count: ${storeRefCount}`,
                        recommendation: "Ячейка TVM вмещает не более 1023 бит и 4 ссылок. Разбейте данные на несколько ячеек.",
                    });
                }
            });

            return issues;
        },
    };
}

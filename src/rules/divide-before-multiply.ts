// Detects integer division results that are multiplied immediately and may lose precision.
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

export function createDivideBeforeMultiplyRule(): Rule {
    return {
        id: "divide-before-multiply",
        title: "Division result multiplied immediately after truncation",
        severity: "HIGH",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                const label = getDeclarationLabel(decl);
                const declarationLine = getDeclarationLine(ctx.sourceCode, decl);

                traverseStatements(decl.statements ?? [], (statement) => {
                    const statementLine = getLineFromLoc(statement?.loc) ?? declarationLine;
                    const nodesToInspect = [statement.expression, statement.condition];

                    for (const rootNode of nodesToInspect) {
                        traverseAst(rootNode, (node) => {
                            if (node?.kind !== "op_binary" || node.op !== "*") {
                                return;
                            }

                            const leftIsDivision = node.left?.kind === "op_binary" && node.left.op === "/";
                            const rightIsDivision = node.right?.kind === "op_binary" && node.right.op === "/";
                            if (!leftIsDivision && !rightIsDivision) {
                                return;
                            }

                            issues.push({
                                ruleId: "divide-before-multiply",
                                severity: "HIGH",
                                title: "Division before multiplication loses precision",
                                message: `В '${label}'${formatContractSuffix(contractName)} найдено выражение, где результат целочисленного деления сразу участвует в умножении.`,
                                line: getLineFromLoc(node?.loc) ?? statementLine,
                                evidence: safeJsonStringify(node),
                                recommendation: "Выполняйте умножение до деления: (a * c) / b для сохранения точности целочисленной арифметики.",
                            });
                        });
                    }
                });
            });

            return issues;
        },
    };
}

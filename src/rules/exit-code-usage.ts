// Detects explicit use of reserved TVM exit codes in throw/nativeThrow/require calls.
import type { Issue, Rule } from "../types";
import {
    compactAstStringify,
    formatContractSuffix,
    getDeclarationLabel,
    getDeclarationLine,
    getLineFromLoc,
    traverseAst,
    traverseStatements,
    visitExecutableDeclarations,
} from "../utils";

function getReservedExitCode(args: any[]): number | undefined {
    for (const arg of args ?? []) {
        if (arg?.kind !== "number") {
            continue;
        }

        const value = Number(arg.value);
        if (Number.isFinite(value) && value >= 2 && value <= 255) {
            return value;
        }
    }

    return undefined;
}

export function createExitCodeUsageRule(): Rule {
    return {
        id: "exit-code-usage",
        title: "Reserved TVM exit code used explicitly",
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
                            if (node?.kind !== "static_call") {
                                return;
                            }

                            const functionName = node.function?.text;
                            if (!["throw", "nativeThrow", "require"].includes(functionName)) {
                                return;
                            }

                            const exitCode = getReservedExitCode(node.args ?? []);
                            if (exitCode === undefined) {
                                return;
                            }

                            issues.push({
                                ruleId: "exit-code-usage",
                                severity: "HIGH",
                                title: "Reserved exit code used for custom failure",
                                message: `В '${label}'${formatContractSuffix(contractName)} вызов '${functionName}()' использует зарезервированный код ${exitCode}.`,
                                line: getLineFromLoc(node?.loc) ?? statementLine,
                                evidence: compactAstStringify(node),
                                recommendation: "Коды 0–255 зарезервированы TVM и стандартной библиотекой. Используйте коды начиная с 256 для пользовательских исключений.",
                            });
                        });
                    }
                });
            });

            return issues;
        },
    };
}

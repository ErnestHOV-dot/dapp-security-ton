// Detects random() usage without prior PRG seed preparation on the same execution path.
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

function analyzeBlock(
    statements: any[],
    seeded: boolean,
    ctx: { issues: Issue[]; label: string; contractName?: string; declarationLine?: number },
): boolean {
    let isSeeded = seeded;

    for (const statement of statements ?? []) {
        isSeeded = analyzeStatement(statement, isSeeded, ctx);
    }

    return isSeeded;
}

function analyzeStatement(
    statement: any,
    seeded: boolean,
    ctx: { issues: Issue[]; label: string; contractName?: string; declarationLine?: number },
): boolean {
    const statementLine = getLineFromLoc(statement?.loc) ?? ctx.declarationLine;

    if (statement.kind === "statement_condition") {
        inspectExpression(statement.condition, seeded, statementLine, ctx);
        const trueSeeded = analyzeBlock(statement.trueStatements ?? [], seeded, ctx);
        const falseSeeded = analyzeBlock(statement.falseStatements ?? [], seeded, ctx);
        return trueSeeded && falseSeeded;
    }

    if (
        statement.kind === "statement_while" ||
        statement.kind === "statement_until" ||
        statement.kind === "statement_repeat" ||
        statement.kind === "statement_foreach"
    ) {
        inspectExpression(statement.condition, seeded, statementLine, ctx);
        analyzeBlock(statement.statements ?? [], seeded, ctx);
        return seeded;
    }

    if (statement.kind === "statement_expression") {
        const callName = statement.expression?.kind === "static_call" ? statement.expression.function?.text : undefined;
        if (callName === "nativePrepareRandom" || callName === "setPRGSeed") {
            inspectExpression(statement.expression, true, statementLine, ctx);
            return true;
        }
    }

    inspectExpression(statement.expression, seeded, statementLine, ctx);
    return seeded;
}

function inspectExpression(
    expression: any,
    seeded: boolean,
    line: number | undefined,
    ctx: { issues: Issue[]; label: string; contractName?: string },
) {
    if (!expression) {
        return;
    }

    traverseAst(expression, (node) => {
        if (node?.kind !== "static_call") {
            return;
        }

        const functionName = node.function?.text;
        if (functionName !== "random" && functionName !== "randomInt") {
            return;
        }

        if (seeded) {
            return;
        }

        ctx.issues.push({
            ruleId: "ensure-prg-seed",
            severity: "MEDIUM",
            title: "PRG used without explicit seed preparation",
            message: `В '${ctx.label}'${formatContractSuffix(ctx.contractName)} вызов '${functionName}()' выполняется без предшествующего nativePrepareRandom()/setPRGSeed() по тому же пути.`,
            line: getLineFromLoc(node?.loc) ?? line,
            evidence: compactAstStringify(node),
            recommendation: "В TON seed генератора случайных чисел основан на seed блока, которым валидатор может управлять. Всегда вызывайте nativePrepareRandom() перед random() и избегайте random() в контрактах с финансовой логикой.",
        });
    });
}

export function createEnsurePrgSeedRule(): Rule {
    return {
        id: "ensure-prg-seed",
        title: "PRG is used without prior seeding",
        severity: "MEDIUM",
        run(ctx) {
            const issues: Issue[] = [];

            visitExecutableDeclarations(ctx.ast, (decl, contractName) => {
                analyzeBlock(decl.statements ?? [], false, {
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

import { getAstFactory, getParser } from "@tact-lang/compiler";
import * as fs from "fs";
import type { AnalysisContext, Issue, Rule } from "./types";
import { BLUE, CYAN, RED, RESET, compareIssues, getSeverityColor } from "./utils";

function runRules(ctx: AnalysisContext, rules: Rule[]): Issue[] {
    return rules
        .flatMap((rule) =>
            rule.run(ctx).map((issue) => ({
                ...issue,
                ruleId: issue.ruleId || rule.id,
                title: issue.title || rule.title,
                severity: issue.severity || rule.severity,
            })),
        )
        .sort((left, right) => compareIssues(left, right));
}

export async function runLinter(filename: string, rules: Rule[]) {
    console.log(`${CYAN}Читаем файл: ${filename}...${RESET}`);

    try {
        const sourceCode = fs.readFileSync(filename, "utf-8");
        const astFactory = getAstFactory();
        const parser = getParser(astFactory);

        const ast = parser.parse({
            path: filename,
            code: sourceCode,
            origin: "user",
        });

        if (!ast?.items) {
            throw new Error("Пустой AST.");
        }

        console.log(`${CYAN}Анализ запущен...${RESET}\n`);

        const ctx: AnalysisContext = {
            sourceCode,
            ast,
        };

        const issues = runRules(ctx, rules);

        printContainerSummary(ast);
        printIssues(issues);

        console.log(`\n${CYAN}Анализ завершен.${RESET}`);
    } catch (e: any) {
        if (e.code === "ENOENT") {
            console.error(`${RED}Файл '${filename}' не найден!${RESET}`);
            return;
        }

        console.error(`${RED}Ошибка парсинга:${RESET} ${e.message}`);
    }
}

function printContainerSummary(ast: any) {
    const containerNames = (ast.items ?? [])
        .filter((entry: any) => entry.kind === "contract" || entry.kind === "trait")
        .map((entry: any) => entry.name?.text)
        .filter(Boolean)
        .sort((left: string, right: string) => left.localeCompare(right));

    for (const name of containerNames) {
        console.log(`${BLUE}Checking container:${RESET} [${name}]`);
    }

    if (containerNames.length > 0) {
        console.log("");
    }
}

function printIssues(issues: Issue[]) {
    if (issues.length === 0) {
        console.log(`${CYAN}Проблем не найдено.${RESET}`);
        return;
    }

    for (const issue of issues) {
        const line = issue.line ?? "?";
        const color = getSeverityColor(issue.severity);
        console.log(`   ${color}[${issue.severity}]${RESET} Line ${line} ${issue.ruleId}: ${issue.title}`);
        console.log(`      ${issue.message}`);

        if (issue.evidence) {
            console.log(`      Evidence: ${issue.evidence}`);
        }

        if (issue.recommendation) {
            console.log(`      Recommendation: ${issue.recommendation}`);
        }
    }
}

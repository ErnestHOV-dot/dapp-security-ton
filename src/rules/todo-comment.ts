// Detects TODO/FIXME comments left in source code.
import type { Issue, Rule } from "../types";

export function createTodoCommentRule(): Rule {
    return {
        id: "todo-comment",
        title: "TODO/FIXME comment left in source",
        severity: "LOW",
        run(ctx) {
            const issues: Issue[] = [];
            const lines = ctx.sourceCode.split("\n");

            lines.forEach((line, index) => {
                if (!line.includes("TODO") && !line.includes("FIXME")) {
                    return;
                }

                issues.push({
                    ruleId: "todo-comment",
                    severity: "LOW",
                    title: "TODO/FIXME comment left in source",
                    message: `Оставлен комментарий TODO/FIXME: "${line.trim()}"`,
                    line: index + 1,
                    evidence: line.trim(),
                    recommendation: "Удалите комментарий или оформите задачу вне кода.",
                });
            });

            return issues;
        },
    };
}

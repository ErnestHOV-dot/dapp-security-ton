export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface Issue {
    ruleId: string;
    severity: Severity;
    title: string;
    message: string;
    line?: number;
    evidence?: string;
    recommendation?: string;
}

export interface AnalysisContext {
    sourceCode: string;
    ast: any;
    contractName?: string;
}

export interface Rule {
    id: string;
    title: string;
    severity: Severity;
    run(ctx: AnalysisContext): Issue[];
}

export interface FieldMutationSummary {
    operations: Set<string>;
    line: number;
    samples: string[];
}

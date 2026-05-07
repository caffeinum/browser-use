export declare class LLMException extends Error {
    readonly statusCode: number;
    readonly detail: string;
    constructor(statusCode: number, detail: string);
}
export declare class JudgeSchemaInvalidError extends Error {
    readonly judge: 'simple_judge' | 'judge_trace';
    readonly attempts: number;
    readonly prettyIssues: string;
    readonly rawCompletion: unknown;
    constructor(judge: 'simple_judge' | 'judge_trace', attempts: number, prettyIssues: string, rawCompletion: unknown);
}
export declare class URLNotAllowedError extends Error {
    readonly url: string;
    readonly allowedDomains: string[];
    constructor(url: string, allowedDomains: string[]);
}

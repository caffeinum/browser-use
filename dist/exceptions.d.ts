export declare class LLMException extends Error {
    readonly statusCode: number;
    readonly detail: string;
    constructor(statusCode: number, detail: string);
}
export declare class URLNotAllowedError extends Error {
    readonly url: string;
    readonly allowedDomains: string[];
    constructor(url: string, allowedDomains: string[]);
}

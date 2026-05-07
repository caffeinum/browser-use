export class LLMException extends Error {
    statusCode;
    detail;
    constructor(statusCode, detail) {
        super(`Error ${statusCode}: ${detail}`);
        this.statusCode = statusCode;
        this.detail = detail;
        this.name = 'LLMException';
    }
}
export class JudgeSchemaInvalidError extends Error {
    judge;
    attempts;
    prettyIssues;
    rawCompletion;
    constructor(judge, attempts, prettyIssues, rawCompletion) {
        super(`Judge (${judge}) failed schema validation after ${attempts} attempt(s). ` +
            `Issues:\n${prettyIssues}\n` +
            `Raw completion: ${typeof rawCompletion === 'string' ? rawCompletion : JSON.stringify(rawCompletion)}`);
        this.judge = judge;
        this.attempts = attempts;
        this.prettyIssues = prettyIssues;
        this.rawCompletion = rawCompletion;
        this.name = 'JudgeSchemaInvalidError';
    }
}
export class URLNotAllowedError extends Error {
    url;
    allowedDomains;
    constructor(url, allowedDomains) {
        super(`URL "${url}" is not allowed. ` +
            `Only domains matching ${JSON.stringify(allowedDomains)} are permitted. ` +
            `This is enforced because sensitive_data was provided to Agent.`);
        this.url = url;
        this.allowedDomains = allowedDomains;
        this.name = 'URLNotAllowedError';
    }
}

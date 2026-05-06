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

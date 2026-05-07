export class LLMException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string
  ) {
    super(`Error ${statusCode}: ${detail}`);
    this.name = 'LLMException';
  }
}

export class JudgeSchemaInvalidError extends Error {
  constructor(
    public readonly judge: 'simple_judge' | 'judge_trace',
    public readonly attempts: number,
    public readonly prettyIssues: string,
    public readonly rawCompletion: unknown
  ) {
    super(
      `Judge (${judge}) failed schema validation after ${attempts} attempt(s). ` +
        `Issues:\n${prettyIssues}\n` +
        `Raw completion: ${typeof rawCompletion === 'string' ? rawCompletion : JSON.stringify(rawCompletion)}`
    );
    this.name = 'JudgeSchemaInvalidError';
  }
}

export class URLNotAllowedError extends Error {
  constructor(
    public readonly url: string,
    public readonly allowedDomains: string[]
  ) {
    super(
      `URL "${url}" is not allowed. ` +
        `Only domains matching ${JSON.stringify(allowedDomains)} are permitted. ` +
        `This is enforced because sensitive_data was provided to Agent.`
    );
    this.name = 'URLNotAllowedError';
  }
}

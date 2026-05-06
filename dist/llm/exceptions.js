export class ModelError extends Error {
}
export class ModelProviderError extends ModelError {
    statusCode;
    model;
    constructor(message, statusCode = 502, model = null) {
        super(message);
        this.statusCode = statusCode;
        this.model = model;
        this.name = 'ModelProviderError';
    }
}
export class ModelRateLimitError extends ModelProviderError {
    constructor(message, statusCode = 429, model = null) {
        super(message, statusCode, model);
        this.name = 'ModelRateLimitError';
    }
}

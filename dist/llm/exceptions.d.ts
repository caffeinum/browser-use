export declare class ModelError extends Error {
}
export declare class ModelProviderError extends ModelError {
    statusCode: number;
    model: string | null;
    constructor(message: string, statusCode?: number, model?: string | null);
}
export declare class ModelRateLimitError extends ModelProviderError {
    constructor(message: string, statusCode?: number, model?: string | null);
}

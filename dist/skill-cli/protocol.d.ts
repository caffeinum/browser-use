export interface RequestInit {
    id: string;
    action: string;
    session: string;
    params?: Record<string, unknown>;
}
export declare class Request {
    id: string;
    action: string;
    session: string;
    params: Record<string, unknown>;
    constructor(init: RequestInit);
    to_json(): string;
    static from_json(data: string): Request;
}
export interface ResponseInit {
    id: string;
    success: boolean;
    data?: unknown;
    error?: string | null;
}
export declare class Response {
    id: string;
    success: boolean;
    data: unknown;
    error: string | null;
    constructor(init: ResponseInit);
    to_json(): string;
    static from_json(data: string): Response;
}

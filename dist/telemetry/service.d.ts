import type { BaseTelemetryEvent } from './views.js';
export declare class ProductTelemetry {
    private client;
    private debugLogging;
    private userIdFile;
    private cachedUserId;
    constructor();
    capture(event: BaseTelemetryEvent): void;
    flush(): void;
    get userId(): string;
}
export declare const productTelemetry: ProductTelemetry;

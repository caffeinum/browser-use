export declare class MistralSchemaOptimizer {
    static readonly UNSUPPORTED_KEYWORDS: Set<string>;
    static createMistralCompatibleSchema(rawSchema: Record<string, unknown>, options?: {
        removeMinItems?: boolean;
        removeDefaults?: boolean;
    }): Record<string, unknown>;
    static stripUnsupportedKeywords(value: unknown): any;
}

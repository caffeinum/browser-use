type JsonSchema = Record<string, unknown>;
interface ZodJsonSchemaOptions {
    name?: string;
    target?: string;
    [key: string]: unknown;
}
export declare const zodSchemaToJsonSchema: (schema: unknown, options?: ZodJsonSchemaOptions) => JsonSchema;
export declare class SchemaOptimizer {
    static createOptimizedJsonSchema(schema: JsonSchema, options?: {
        removeMinItems?: boolean;
        removeDefaults?: boolean;
    }): JsonSchema;
    static createGeminiOptimizedSchema(schema: JsonSchema): JsonSchema;
    static makeStrictCompatible(schema: any): void;
}
export {};

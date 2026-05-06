import { z } from 'zod';
export declare const findUnsupportedJsonSchemaKeyword: (schema: unknown) => string | null;
export declare const schemaDictToZodSchema: (schema: unknown) => z.ZodTypeAny;
export declare const resolveDefaultForSchema: (schema: unknown) => unknown;
export declare const normalizeStructuredDataBySchema: (value: unknown, schema: unknown) => unknown;
export declare const schema_dict_to_zod_schema: (schema: unknown) => z.ZodTypeAny;

import type { APIError } from 'groq-sdk';
export declare class ParseFailedGenerationError extends Error {
    constructor(message: string);
}
/**
 * Extract JSON from model output, handling both plain JSON and code-block-wrapped JSON.
 * This is used to parse Groq's failed_generation field when an API error occurs.
 *
 * @param error - The Groq API error containing failed_generation
 * @param outputFormat - An object with a parse method (typically a Zod schema)
 * @returns The parsed output in the expected format
 * @throws ParseFailedGenerationError if the failed_generation field is missing
 * @throws Error if JSON parsing fails
 */
export declare function tryParseGroqFailedGeneration<T>(error: APIError & {
    body?: {
        error?: {
            failed_generation?: string;
        };
    };
}, outputFormat: {
    parse: (input: string) => T;
}): T;
/**
 * Fix control characters in JSON string values to make them valid JSON.
 * This function escapes literal control characters (newlines, tabs, etc.) that
 * appear inside JSON string values, while preserving the JSON structure.
 *
 * @param content - The JSON string to fix
 * @returns The fixed JSON string
 */
export declare function fixControlCharactersInJson(content: string): string;

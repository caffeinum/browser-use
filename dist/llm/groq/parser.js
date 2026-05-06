import { logger } from '../../logging-config.js';
export class ParseFailedGenerationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ParseFailedGenerationError';
    }
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
export function tryParseGroqFailedGeneration(error, outputFormat) {
    try {
        const failedGeneration = error.body?.error?.failed_generation;
        if (!failedGeneration) {
            throw new Error('No failed_generation field in error body');
        }
        let content = failedGeneration;
        // If content is wrapped in code blocks, extract just the JSON part
        if (content.includes('```')) {
            // Find the JSON content between code blocks
            const parts = content.split('```');
            content = parts[1] || content;
            // Remove language identifier if present (e.g., 'json\n')
            if (content.includes('\n')) {
                const [first, ...rest] = content.split('\n');
                // Check if first line is just a language identifier
                if (first.trim().length < 20) {
                    content = rest.join('\n');
                }
            }
        }
        // Remove html-like tags before the first { and after the last }
        // This handles cases like <|header_start|>assistant<|header_end|> and <function=AgentOutput>
        // Only remove content before { if content doesn't already start with {
        if (!content.trim().startsWith('{')) {
            content = content.replace(/^.*?(?=\{)/s, '');
        }
        // Remove common HTML-like tags and patterns at the end, but be more conservative
        // Look for patterns like </function>, <|header_start|>, etc. after the JSON
        content = content.replace(/\}(\s*<[^>]*>.*?$)/s, '}');
        content = content.replace(/\}(\s*<\|[^|]*\|>.*?$)/s, '}');
        // Handle extra characters after the JSON, including stray braces
        // Find the position of the last } that would close the main JSON object
        content = content.trim();
        if (content.endsWith('}')) {
            // Try to parse and see if we get valid JSON
            try {
                JSON.parse(content);
            }
            catch {
                // If parsing fails, try to find the correct end of the JSON
                // by counting braces and removing anything after the balanced JSON
                let braceCount = 0;
                let lastValidPos = -1;
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    if (char === '{') {
                        braceCount++;
                    }
                    else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            lastValidPos = i + 1;
                            break;
                        }
                    }
                }
                if (lastValidPos > 0) {
                    content = content.substring(0, lastValidPos);
                }
            }
        }
        // Fix control characters in JSON strings before parsing
        // This handles cases where literal control characters appear in JSON values
        content = fixControlCharactersInJson(content);
        // Parse the cleaned content
        let resultDict = JSON.parse(content);
        // Some models occasionally respond with a list containing one dict
        if (Array.isArray(resultDict) &&
            resultDict.length === 1 &&
            typeof resultDict[0] === 'object') {
            resultDict = resultDict[0];
        }
        logger.debug(`Successfully parsed model output: ${JSON.stringify(resultDict)}`);
        return outputFormat.parse(JSON.stringify(resultDict));
    }
    catch (err) {
        if (err instanceof Error &&
            err.message.includes('No failed_generation field')) {
            throw new ParseFailedGenerationError(err.message);
        }
        if (err instanceof SyntaxError) {
            logger.warning(`Failed to parse model output: ${err.message}`);
            throw new Error(`Could not parse response. ${err.message}`, {
                cause: err,
            });
        }
        const errorMessage = error.message || String(error);
        throw new ParseFailedGenerationError(errorMessage);
    }
}
/**
 * Fix control characters in JSON string values to make them valid JSON.
 * This function escapes literal control characters (newlines, tabs, etc.) that
 * appear inside JSON string values, while preserving the JSON structure.
 *
 * @param content - The JSON string to fix
 * @returns The fixed JSON string
 */
export function fixControlCharactersInJson(content) {
    try {
        // First try to parse as-is to see if it's already valid
        JSON.parse(content);
        return content;
    }
    catch {
        // Continue to fix the content
    }
    // More sophisticated approach: only escape control characters inside string values
    // while preserving JSON structure formatting
    const result = [];
    let i = 0;
    let inString = false;
    let escaped = false;
    while (i < content.length) {
        const char = content[i];
        if (!inString) {
            // Outside of string - check if we're entering a string
            if (char === '"') {
                inString = true;
            }
            result.push(char);
        }
        else {
            // Inside string - handle escaping and control characters
            if (escaped) {
                // Previous character was backslash, so this character is escaped
                result.push(char);
                escaped = false;
            }
            else if (char === '\\') {
                // This is an escape character
                result.push(char);
                escaped = true;
            }
            else if (char === '"') {
                // End of string
                result.push(char);
                inString = false;
            }
            else if (char === '\n') {
                // Literal newline inside string - escape it
                result.push('\\n');
            }
            else if (char === '\r') {
                // Literal carriage return inside string - escape it
                result.push('\\r');
            }
            else if (char === '\t') {
                // Literal tab inside string - escape it
                result.push('\\t');
            }
            else if (char === '\b') {
                // Literal backspace inside string - escape it
                result.push('\\b');
            }
            else if (char === '\f') {
                // Literal form feed inside string - escape it
                result.push('\\f');
            }
            else if (char.charCodeAt(0) < 32) {
                // Other control characters inside string - convert to unicode escape
                const code = char.charCodeAt(0);
                result.push(`\\u${code.toString(16).padStart(4, '0')}`);
            }
            else {
                // Normal character inside string
                result.push(char);
            }
        }
        i++;
    }
    return result.join('');
}

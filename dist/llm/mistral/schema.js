import { SchemaOptimizer } from '../schema.js';
export class MistralSchemaOptimizer {
    static UNSUPPORTED_KEYWORDS = new Set([
        'minLength',
        'maxLength',
        'pattern',
        'format',
    ]);
    static createMistralCompatibleSchema(rawSchema, options = {}) {
        const baseSchema = SchemaOptimizer.createOptimizedJsonSchema(rawSchema, {
            removeMinItems: options.removeMinItems ?? false,
            removeDefaults: options.removeDefaults ?? false,
        });
        return this.stripUnsupportedKeywords(baseSchema);
    }
    static stripUnsupportedKeywords(value) {
        if (Array.isArray(value)) {
            return value.map((item) => this.stripUnsupportedKeywords(item));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        return Object.fromEntries(Object.entries(value)
            .filter(([key]) => !this.UNSUPPORTED_KEYWORDS.has(key))
            .map(([key, item]) => [key, this.stripUnsupportedKeywords(item)]));
    }
}

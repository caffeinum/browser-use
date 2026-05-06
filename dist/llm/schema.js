import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
export const zodSchemaToJsonSchema = (schema, options = {}) => {
    try {
        const toJSONSchema = z?.toJSONSchema;
        if (typeof toJSONSchema === 'function') {
            const converted = toJSONSchema(schema);
            if (converted && typeof converted === 'object') {
                return converted;
            }
        }
    }
    catch {
        // Fall back to zod-to-json-schema below.
    }
    return zodToJsonSchema(schema, options);
};
export class SchemaOptimizer {
    static createOptimizedJsonSchema(schema, options = {}) {
        const defsLookup = schema.$defs ?? {};
        const removeMinItems = options.removeMinItems ?? false;
        const removeDefaults = options.removeDefaults ?? false;
        const optimize = (obj, inProperties = false) => {
            if (Array.isArray(obj)) {
                return obj.map((item) => optimize(item, inProperties));
            }
            if (obj && typeof obj === 'object') {
                let flattenedRef = null;
                const optimized = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (key === '$defs')
                        continue;
                    // Some OpenAI-compatible providers reject this JSON Schema keyword.
                    if (key === 'propertyNames')
                        continue;
                    if (key === 'title' && !inProperties)
                        continue;
                    if (removeMinItems && (key === 'minItems' || key === 'min_items')) {
                        continue;
                    }
                    if (removeDefaults && key === 'default')
                        continue;
                    if (key === '$ref' && typeof value === 'string') {
                        const refName = value.split('/').pop();
                        if (defsLookup[refName]) {
                            flattenedRef = optimize(defsLookup[refName], inProperties);
                        }
                        continue;
                    }
                    if (key === 'additionalProperties') {
                        if (value && typeof value === 'object' && !Array.isArray(value)) {
                            const optimizedAdditional = optimize(value, inProperties);
                            optimized[key] =
                                Object.keys(optimizedAdditional).length === 0
                                    ? true
                                    : optimizedAdditional;
                        }
                        else {
                            optimized[key] = value;
                        }
                        continue;
                    }
                    if (key === 'properties') {
                        optimized[key] = optimize(value, true);
                        continue;
                    }
                    if (typeof value === 'object' && value !== null) {
                        optimized[key] = optimize(value, inProperties);
                        continue;
                    }
                    optimized[key] = value;
                }
                const result = flattenedRef
                    ? { ...flattenedRef, ...optimized }
                    : optimized;
                const hasExplicitProperties = result.properties &&
                    typeof result.properties === 'object' &&
                    !Array.isArray(result.properties);
                if (result.type === 'object' &&
                    result.additionalProperties === undefined &&
                    hasExplicitProperties) {
                    result.additionalProperties = false;
                }
                return result;
            }
            return obj;
        };
        const optimizedSchema = optimize(schema);
        const ensureAdditionalProperties = (obj) => {
            if (Array.isArray(obj)) {
                obj.forEach(ensureAdditionalProperties);
                return;
            }
            if (obj && typeof obj === 'object') {
                const hasExplicitProperties = obj.properties &&
                    typeof obj.properties === 'object' &&
                    !Array.isArray(obj.properties);
                if (obj.type === 'object' &&
                    obj.additionalProperties === undefined &&
                    hasExplicitProperties) {
                    obj.additionalProperties = false;
                }
                Object.values(obj).forEach(ensureAdditionalProperties);
            }
        };
        const stripStructuredDoneSuccess = (obj) => {
            if (Array.isArray(obj)) {
                obj.forEach(stripStructuredDoneSuccess);
                return;
            }
            if (!obj || typeof obj !== 'object') {
                return;
            }
            const properties = obj.properties;
            if (obj.type === 'object' &&
                properties &&
                typeof properties === 'object' &&
                !Array.isArray(properties)) {
                const dataSchema = properties.data;
                const successSchema = properties.success;
                const looksLikeStructuredDone = dataSchema &&
                    successSchema &&
                    successSchema.type === 'boolean' &&
                    successSchema.description ===
                        'True if user_request completed successfully';
                if (looksLikeStructuredDone) {
                    delete properties.success;
                    if (Array.isArray(obj.required)) {
                        obj.required = obj.required.filter((name) => name !== 'success');
                    }
                }
            }
            Object.values(obj).forEach(stripStructuredDoneSuccess);
        };
        const stripExtractOutputSchema = (obj, parentKey = null) => {
            if (Array.isArray(obj)) {
                obj.forEach((item) => stripExtractOutputSchema(item, parentKey));
                return;
            }
            if (!obj || typeof obj !== 'object') {
                return;
            }
            const isExtractActionSchema = parentKey === 'extract_structured_data' || parentKey === 'extract';
            if (isExtractActionSchema && obj.type === 'object') {
                const props = obj.properties;
                if (props && typeof props === 'object' && !Array.isArray(props)) {
                    delete props.output_schema;
                }
                if (Array.isArray(obj.required)) {
                    obj.required = obj.required.filter((name) => name !== 'output_schema');
                }
            }
            for (const [key, value] of Object.entries(obj)) {
                stripExtractOutputSchema(value, key);
            }
        };
        ensureAdditionalProperties(optimizedSchema);
        stripStructuredDoneSuccess(optimizedSchema);
        stripExtractOutputSchema(optimizedSchema);
        SchemaOptimizer.makeStrictCompatible(optimizedSchema);
        return optimizedSchema;
    }
    static createGeminiOptimizedSchema(schema) {
        return SchemaOptimizer.createOptimizedJsonSchema(schema);
    }
    static makeStrictCompatible(schema) {
        if (Array.isArray(schema)) {
            schema.forEach(SchemaOptimizer.makeStrictCompatible);
            return;
        }
        if (schema && typeof schema === 'object') {
            for (const [key, value] of Object.entries(schema)) {
                if (key !== 'required' && value && typeof value === 'object') {
                    SchemaOptimizer.makeStrictCompatible(value);
                }
            }
            if (schema.type === 'object' && schema.properties) {
                schema.required = Object.keys(schema.properties);
            }
        }
    }
}

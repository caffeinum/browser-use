import { z } from 'zod';
const UNSUPPORTED_KEYWORDS = new Set([
    '$ref',
    'allOf',
    'anyOf',
    'oneOf',
    'not',
    '$defs',
    'definitions',
    'if',
    'then',
    'else',
    'dependentSchemas',
    'dependentRequired',
]);
const PRIMITIVE_DEFAULTS = {
    string: '',
    number: 0.0,
    integer: 0,
    boolean: false,
};
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const getTypeList = (schema) => {
    const schemaType = schema.type;
    if (Array.isArray(schemaType)) {
        return schemaType.map((item) => String(item).toLowerCase());
    }
    if (typeof schemaType === 'string' && schemaType.trim().length > 0) {
        return [schemaType.toLowerCase()];
    }
    return ['string'];
};
export const findUnsupportedJsonSchemaKeyword = (schema) => {
    if (Array.isArray(schema)) {
        for (const item of schema) {
            const found = findUnsupportedJsonSchemaKeyword(item);
            if (found) {
                return found;
            }
        }
        return null;
    }
    if (!isRecord(schema)) {
        return null;
    }
    for (const [key, value] of Object.entries(schema)) {
        if (UNSUPPORTED_KEYWORDS.has(key)) {
            return key;
        }
        const found = findUnsupportedJsonSchemaKeyword(value);
        if (found) {
            return found;
        }
    }
    return null;
};
const checkUnsupported = (schema) => {
    const unsupported = findUnsupportedJsonSchemaKeyword(schema);
    if (unsupported) {
        throw new Error(`Unsupported JSON Schema keyword: ${unsupported}`);
    }
};
const resolveType = (schema, name) => {
    checkUnsupported(schema);
    const typeList = getTypeList(schema);
    if (Array.isArray(schema.enum)) {
        return z.string();
    }
    if (typeList.includes('object')) {
        const properties = isRecord(schema.properties)
            ? schema.properties
            : null;
        const base = properties
            ? buildObjectSchema(schema, name)
            : z.record(z.string(), z.any());
        return typeList.includes('null') || schema.nullable === true
            ? base.nullable()
            : base;
    }
    if (typeList.includes('array')) {
        const items = isRecord(schema.items)
            ? resolveType(schema.items, `${name}_item`)
            : z.any();
        const arraySchema = z.array(items);
        return typeList.includes('null') || schema.nullable === true
            ? arraySchema.nullable()
            : arraySchema;
    }
    let primitive = z.string();
    if (typeList.includes('integer')) {
        primitive = z.number().int();
    }
    else if (typeList.includes('number')) {
        primitive = z.number();
    }
    else if (typeList.includes('boolean')) {
        primitive = z.boolean();
    }
    else if (typeList.includes('null')) {
        primitive = z.null();
    }
    else if (typeList.includes('string')) {
        primitive = z.string();
    }
    if (schema.nullable === true && !typeList.includes('null')) {
        return primitive.nullable();
    }
    return primitive;
};
const applyOptionalDefaults = (propertySchema, propertyType) => {
    if (Object.prototype.hasOwnProperty.call(propertySchema, 'default')) {
        return propertyType.default(propertySchema.default);
    }
    const typeList = getTypeList(propertySchema);
    const allowsNull = propertySchema.nullable === true || typeList.includes('null');
    if (allowsNull) {
        return propertyType.nullable().default(null);
    }
    if (Array.isArray(propertySchema.enum)) {
        return propertyType.nullable().default(null);
    }
    if (typeList.includes('array')) {
        return propertyType.default([]);
    }
    const primitiveType = typeList.find((item) => item in PRIMITIVE_DEFAULTS);
    if (primitiveType) {
        return propertyType.default(PRIMITIVE_DEFAULTS[primitiveType]);
    }
    return propertyType.nullable().default(null);
};
const buildObjectSchema = (schema, name) => {
    checkUnsupported(schema);
    const properties = isRecord(schema.properties)
        ? schema.properties
        : {};
    const required = new Set(Array.isArray(schema.required)
        ? schema.required
            .map((item) => String(item))
            .filter((item) => item.length > 0)
        : []);
    const shape = {};
    for (const [propertyName, propertySchema] of Object.entries(properties)) {
        if (!isRecord(propertySchema)) {
            shape[propertyName] = z.any();
            continue;
        }
        const propertyType = resolveType(propertySchema, `${name}_${propertyName}`);
        if (required.has(propertyName)) {
            shape[propertyName] = propertyType;
            continue;
        }
        shape[propertyName] = applyOptionalDefaults(propertySchema, propertyType);
    }
    return z.object(shape).strict();
};
export const schemaDictToZodSchema = (schema) => {
    if (!isRecord(schema)) {
        throw new Error('Top-level schema must be an object');
    }
    checkUnsupported(schema);
    const typeList = getTypeList(schema);
    if (!typeList.includes('object')) {
        throw new Error('Top-level schema must have type "object"');
    }
    if (!isRecord(schema.properties) || !Object.keys(schema.properties).length) {
        throw new Error('Top-level schema must have at least one property');
    }
    const modelName = typeof schema.title === 'string' && schema.title.trim().length > 0
        ? schema.title
        : 'DynamicExtractionModel';
    return buildObjectSchema(schema, modelName);
};
export const resolveDefaultForSchema = (schema) => {
    if (!isRecord(schema)) {
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
        return schema.default;
    }
    const typeList = getTypeList(schema);
    const allowsNull = schema.nullable === true || typeList.includes('null');
    if (allowsNull) {
        return null;
    }
    if (Array.isArray(schema.enum)) {
        return null;
    }
    if (typeList.includes('array')) {
        return [];
    }
    const primitiveType = typeList.find((item) => item in PRIMITIVE_DEFAULTS);
    if (primitiveType) {
        return PRIMITIVE_DEFAULTS[primitiveType];
    }
    return null;
};
export const normalizeStructuredDataBySchema = (value, schema) => {
    if (!isRecord(schema)) {
        return value;
    }
    const typeList = getTypeList(schema);
    if (typeList.includes('object')) {
        const properties = isRecord(schema.properties)
            ? schema.properties
            : {};
        const required = new Set(Array.isArray(schema.required)
            ? schema.required
                .map((item) => String(item))
                .filter((item) => item.length > 0)
            : []);
        const source = isRecord(value) ? value : {};
        const normalized = {};
        for (const [propertyName, propertySchema] of Object.entries(properties)) {
            if (Object.prototype.hasOwnProperty.call(source, propertyName)) {
                normalized[propertyName] = normalizeStructuredDataBySchema(source[propertyName], propertySchema);
                continue;
            }
            if (required.has(propertyName)) {
                continue;
            }
            normalized[propertyName] = resolveDefaultForSchema(propertySchema);
        }
        for (const [propertyName, propertyValue] of Object.entries(source)) {
            if (!Object.prototype.hasOwnProperty.call(normalized, propertyName)) {
                normalized[propertyName] = propertyValue;
            }
        }
        return normalized;
    }
    if (typeList.includes('array') &&
        Array.isArray(value) &&
        isRecord(schema.items)) {
        return value.map((item) => normalizeStructuredDataBySchema(item, schema.items));
    }
    return value;
};
export const schema_dict_to_zod_schema = schemaDictToZodSchema;

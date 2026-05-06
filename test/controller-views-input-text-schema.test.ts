import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InputTextActionSchema } from '../src/controller/views.js';

describe('InputTextActionSchema JSON Schema shape', () => {
  it('does not render a boolean default adjacent to the integer index field', () => {
    const json = z.toJSONSchema(InputTextActionSchema) as Record<string, any>;
    const props = json.properties as Record<string, any>;

    expect(props.index.type).toBe('integer');
    expect(props.text.type).toBe('string');
    expect(props.clear.type).toBe('boolean');

    // The bug: clear: z.boolean().default(true) emits `default: true` in the
    // JSON Schema, which the LLM bleeds into the adjacent integer index slot
    // (observed prod-bug `index: <boolean>` against bu-2-0).
    expect(props.clear.default).toBeUndefined();
  });

  it('marks clear as optional (not required)', () => {
    const json = z.toJSONSchema(InputTextActionSchema) as Record<string, any>;
    expect(json.required).toEqual(['index', 'text']);
    expect(json.required).not.toContain('clear');
  });

  it('still parses input when clear is omitted', () => {
    const parsed = InputTextActionSchema.parse({ index: 5, text: 'hi' });
    expect(parsed.index).toBe(5);
    expect(parsed.text).toBe('hi');
    expect(parsed.clear).toBeUndefined();
  });

  it('still parses input when clear is set explicitly', () => {
    const parsed = InputTextActionSchema.parse({
      index: 5,
      text: 'hi',
      clear: false,
    });
    expect(parsed.clear).toBe(false);
  });
});

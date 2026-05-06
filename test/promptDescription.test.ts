import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RegisteredAction } from '../src/controller/registry/views.js';

const ScrollActionSchema = z.object({
  down: z.boolean().default(true),
  num_pages: z.number().default(1),
  pages: z.number().optional(),
  index: z.number().int().optional(),
});

describe('RegisteredAction.promptDescription', () => {
  it('renders zod schema as clean JSON Schema, not raw _def dump', () => {
    const action = new RegisteredAction(
      'scroll',
      'Scroll the page',
      async () => ({}),
      ScrollActionSchema
    );

    const prompt = action.promptDescription();
    const jsonStart = prompt.indexOf('{', prompt.indexOf('{scroll:') + '{scroll:'.length);
    const inner = prompt.slice(jsonStart, prompt.lastIndexOf('}'));
    const parsed = JSON.parse(inner) as Record<string, unknown>;

    expect(parsed.type).toBe('object');
    const props = parsed.properties as Record<string, Record<string, unknown>>;
    expect(props.num_pages).toMatchObject({ type: 'number', default: 1 });
    expect(props.down).toMatchObject({ type: 'boolean', default: true });
    expect(props.pages).toMatchObject({ type: 'number' });
    // _def-leak guard: these zod-internal keys must not appear anywhere.
    expect(prompt).not.toContain('innerType');
    expect(prompt).not.toContain('defaultValue');
    expect(prompt).not.toContain('"def":');
    // $schema noise must be stripped.
    expect(prompt).not.toContain('$schema');
  });

  it('still respects skipKeys for done.success and extract.output_schema', () => {
    const doneSchema = z.object({
      success: z.boolean(),
      data: z.object({ value: z.string() }),
    });
    const doneAction = new RegisteredAction(
      'done',
      'Finish',
      async () => ({}),
      doneSchema
    );
    const donePrompt = doneAction.promptDescription();
    expect(donePrompt).toContain('data');
    expect(donePrompt).not.toContain('"success"');
  });
});

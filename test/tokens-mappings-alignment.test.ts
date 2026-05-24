import { describe, expect, it } from 'vitest';
import { CUSTOM_MODEL_PRICING } from '../src/tokens/custom-pricing.js';
import { MODEL_TO_LITELLM } from '../src/tokens/mappings.js';

describe('tokens mappings alignment', () => {
  it('keeps browser-use custom pricing aliases aligned to bu-2-0', () => {
    expect(CUSTOM_MODEL_PRICING['bu-latest']).toBe(
      CUSTOM_MODEL_PRICING['bu-2-0']
    );
    expect(CUSTOM_MODEL_PRICING.smart).toBe(CUSTOM_MODEL_PRICING['bu-2-0']);
  });

  it('maps gemini-flash-latest to litellm provider-prefixed name', () => {
    expect(MODEL_TO_LITELLM['gemini-flash-latest']).toBe(
      'gemini/gemini-flash-latest'
    );
  });
});

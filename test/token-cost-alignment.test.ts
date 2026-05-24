import { describe, expect, it } from 'vitest';
import { TokenCost } from '../src/tokens/service.js';

describe('TokenCost alignment', () => {
  it('returns custom browser-use pricing without LiteLLM cache', async () => {
    const tokenCost = new TokenCost(false);
    const pricing = await tokenCost.getModelPricing('bu-2-0');

    expect(pricing).not.toBeNull();
    expect(pricing?.model).toBe('bu-2-0');
    expect(pricing?.input_cost_per_token).toBeCloseTo(0.6 / 1_000_000);
    expect(pricing?.output_cost_per_token).toBeCloseTo(3.5 / 1_000_000);
    expect(pricing?.cache_read_input_token_cost).toBeCloseTo(0.06 / 1_000_000);
  });

  it('keeps bu-latest and smart aliases aligned with bu-2-0 pricing', async () => {
    const tokenCost = new TokenCost(false);

    const canonical = await tokenCost.getModelPricing('bu-2-0');
    const latest = await tokenCost.getModelPricing('bu-latest');
    const smart = await tokenCost.getModelPricing('smart');

    expect(latest?.input_cost_per_token).toBe(canonical?.input_cost_per_token);
    expect(latest?.output_cost_per_token).toBe(
      canonical?.output_cost_per_token
    );
    expect(latest?.cache_read_input_token_cost).toBe(
      canonical?.cache_read_input_token_cost
    );
    expect(smart?.input_cost_per_token).toBe(canonical?.input_cost_per_token);
    expect(smart?.output_cost_per_token).toBe(canonical?.output_cost_per_token);
    expect(smart?.cache_read_input_token_cost).toBe(
      canonical?.cache_read_input_token_cost
    );
  });

  it('maps gemini-flash-latest to the LiteLLM namespaced key', async () => {
    const tokenCost = new TokenCost(false);
    (tokenCost as any).pricingData = {
      'gemini/gemini-flash-latest': {
        input_cost_per_token: 1.23e-7,
        output_cost_per_token: 4.56e-7,
        cache_read_input_token_cost: 7.89e-8,
        cache_creation_input_token_cost: null,
        max_tokens: 123456,
        max_input_tokens: 65536,
        max_output_tokens: 8192,
      },
    };

    const pricing = await tokenCost.getModelPricing('gemini-flash-latest');

    expect(pricing).not.toBeNull();
    expect(pricing?.model).toBe('gemini-flash-latest');
    expect(pricing?.max_input_tokens).toBe(65536);
    expect(pricing?.input_cost_per_token).toBeCloseTo(1.23e-7);
    expect(pricing?.output_cost_per_token).toBeCloseTo(4.56e-7);
  });
});

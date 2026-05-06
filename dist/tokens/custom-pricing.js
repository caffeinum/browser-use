export const CUSTOM_MODEL_PRICING = {
    'bu-1-0': {
        input_cost_per_token: 0.2 / 1_000_000,
        output_cost_per_token: 2.0 / 1_000_000,
        cache_read_input_token_cost: 0.02 / 1_000_000,
        cache_creation_input_token_cost: null,
        max_tokens: null,
        max_input_tokens: null,
        max_output_tokens: null,
    },
    'bu-2-0': {
        input_cost_per_token: 0.6 / 1_000_000,
        output_cost_per_token: 3.5 / 1_000_000,
        cache_read_input_token_cost: 0.06 / 1_000_000,
        cache_creation_input_token_cost: null,
        max_tokens: null,
        max_input_tokens: null,
        max_output_tokens: null,
    },
};
CUSTOM_MODEL_PRICING['bu-latest'] = CUSTOM_MODEL_PRICING['bu-1-0'];
CUSTOM_MODEL_PRICING.smart = CUSTOM_MODEL_PRICING['bu-1-0'];

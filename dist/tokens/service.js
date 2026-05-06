import fs from 'node:fs';
import path from 'node:path';
import { encode } from 'gpt-tokenizer';
import axios from 'axios';
import { CONFIG } from '../config.js';
import { createLogger } from '../logging-config.js';
import { create_task_with_error_handling } from '../utils.js';
import { CUSTOM_MODEL_PRICING } from './custom-pricing.js';
import { MODEL_TO_LITELLM } from './mappings.js';
const logger = createLogger('browser_use.tokens');
const costLogger = createLogger('browser_use.tokens.cost');
const PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
const CACHE_DIR_NAME = 'browser_use/token_cost';
const ansi = {
    cyan: '\u001b[96m',
    yellow: '\u001b[93m',
    green: '\u001b[92m',
    blue: '\u001b[94m',
    magenta: '\u001b[95m',
    reset: '\u001b[0m',
    bold: '\u001b[1m',
};
const xdgCacheHome = () => {
    const configured = CONFIG.XDG_CACHE_HOME;
    if (configured && path.isAbsolute(configured)) {
        return configured;
    }
    return path.join(process.env.HOME ?? process.cwd(), '.cache');
};
const ensureDir = async (dir) => {
    await fs.promises.mkdir(dir, { recursive: true });
};
const parsePricingTimestamp = (data) => new Date(data.timestamp);
const usagePromptCost = (cost) => {
    if (!cost)
        return 0;
    return (cost.new_prompt_cost +
        (cost.prompt_read_cached_cost ?? 0) +
        (cost.prompt_cache_creation_cost ?? 0));
};
export class TokenCost {
    includeCost;
    usageHistory = [];
    registeredLlms = new WeakSet();
    originalAinvoke = new WeakMap();
    pricingData = null;
    initialized = false;
    cacheDir;
    constructor(includeCost) {
        const envFlag = process.env.BROWSER_USE_CALCULATE_COST?.toLowerCase() === 'true';
        this.includeCost = includeCost ?? envFlag ?? false;
        this.cacheDir = path.join(xdgCacheHome(), CACHE_DIR_NAME);
    }
    async initialize() {
        if (this.initialized)
            return;
        if (this.includeCost) {
            await this.loadPricingData();
        }
        this.initialized = true;
    }
    async loadPricingData() {
        try {
            const cacheFile = await this.findValidCache();
            if (cacheFile) {
                await this.loadFromCache(cacheFile);
                return;
            }
        }
        catch (error) {
            logger.debug(`Failed to load token pricing cache: ${error.message}`);
        }
        await this.fetchAndCachePricing();
    }
    async findValidCache() {
        try {
            await ensureDir(this.cacheDir);
            const files = await fs.promises.readdir(this.cacheDir);
            const jsonFiles = files.filter((file) => file.endsWith('.json'));
            if (!jsonFiles.length) {
                return null;
            }
            const sorted = jsonFiles
                .map((file) => path.join(this.cacheDir, file))
                .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
            for (const file of sorted) {
                const isValid = await this.isCacheValid(file);
                if (isValid) {
                    return file;
                }
                await fs.promises.unlink(file).catch(() => undefined);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async isCacheValid(file) {
        try {
            const content = await fs.promises.readFile(file, 'utf-8');
            const parsed = JSON.parse(content);
            const timestamp = parsePricingTimestamp(parsed);
            return Date.now() - timestamp.getTime() < CACHE_DURATION_MS;
        }
        catch {
            return false;
        }
    }
    async loadFromCache(file) {
        const content = await fs.promises.readFile(file, 'utf-8');
        const cached = JSON.parse(content);
        this.pricingData = cached.data;
    }
    async fetchAndCachePricing() {
        try {
            const response = await axios.get(PRICING_URL, {
                timeout: 30_000,
            });
            this.pricingData = response.data;
            const cached = {
                timestamp: new Date(),
                data: response.data,
            };
            await ensureDir(this.cacheDir);
            const fileName = `pricing_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            await fs.promises.writeFile(path.join(this.cacheDir, fileName), JSON.stringify(cached, null, 2));
        }
        catch (error) {
            logger.debug(`Failed to fetch LiteLLM pricing: ${error.message}`);
            this.pricingData = this.pricingData ?? {};
        }
    }
    addUsage(model, usage) {
        const entry = {
            model,
            timestamp: new Date(),
            usage,
        };
        this.usageHistory.push(entry);
        return entry;
    }
    register_llm(llm) {
        if (this.registeredLlms.has(llm)) {
            return llm;
        }
        this.registeredLlms.add(llm);
        const original = llm.ainvoke.bind(llm);
        this.originalAinvoke.set(llm, original);
        llm.ainvoke = (async (...args) => {
            // @ts-ignore - Spread operator type compatibility
            const result = await original(...args);
            if (result?.usage) {
                const usageEntry = this.addUsage(llm.model, result.usage);
                create_task_with_error_handling(this.logUsage(llm.model, usageEntry), {
                    name: 'log_token_usage',
                    suppress_exceptions: true,
                });
            }
            return result;
        });
        return llm;
    }
    async logUsage(model, entry) {
        if (!this.includeCost) {
            return;
        }
        await this.ensurePricingLoaded();
        const cost = await this.calculateCost(model, entry.usage);
        const inputPart = this.buildInputDisplay(entry.usage, cost);
        const completionTokensFmt = this.formatTokens(entry.usage.completion_tokens);
        const completionSection = this.includeCost && cost && cost.completion_cost > 0
            ? `📤 ${ansi.green}${completionTokensFmt} ($${cost.completion_cost.toFixed(4)})${ansi.reset}`
            : `📤 ${ansi.green}${completionTokensFmt}${ansi.reset}`;
        costLogger.debug(`🧠 ${ansi.cyan}${model}${ansi.reset} | ${inputPart} | ${completionSection}`);
    }
    buildInputDisplay(usage, cost) {
        const parts = [];
        const cached = usage.prompt_cached_tokens ?? 0;
        const cacheCreation = usage.prompt_cache_creation_tokens ?? 0;
        const uncached = usage.prompt_tokens - cached;
        if (cached || cacheCreation) {
            if (uncached > 0) {
                const formatted = this.formatTokens(uncached);
                const costPart = this.includeCost && cost && cost.new_prompt_cost > 0
                    ? ` ($${cost.new_prompt_cost.toFixed(4)})`
                    : '';
                parts.push(`🆕 ${ansi.yellow}${formatted}${costPart}${ansi.reset}`);
            }
            if (cached) {
                const formatted = this.formatTokens(cached);
                const cacheCost = this.includeCost && cost?.prompt_read_cached_cost
                    ? ` ($${cost.prompt_read_cached_cost.toFixed(4)})`
                    : '';
                parts.push(`💾 ${ansi.blue}${formatted}${cacheCost}${ansi.reset}`);
            }
            if (cacheCreation) {
                const formatted = this.formatTokens(cacheCreation);
                const creationCost = this.includeCost && cost?.prompt_cache_creation_cost
                    ? ` ($${cost.prompt_cache_creation_cost.toFixed(4)})`
                    : '';
                parts.push(`🔧 ${ansi.blue}${formatted}${creationCost}${ansi.reset}`);
            }
        }
        else {
            const formatted = this.formatTokens(usage.prompt_tokens);
            const costPart = this.includeCost && cost && cost.new_prompt_cost > 0
                ? ` ($${cost.new_prompt_cost.toFixed(4)})`
                : '';
            parts.push(`📥 ${ansi.yellow}${formatted}${costPart}${ansi.reset}`);
        }
        return parts.join(' + ');
    }
    formatTokens(tokens) {
        if (tokens >= 1_000_000_000)
            return `${(tokens / 1_000_000_000).toFixed(1)}B`;
        if (tokens >= 1_000_000)
            return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000)
            return `${(tokens / 1_000).toFixed(1)}k`;
        return `${tokens}`;
    }
    async calculateCost(model, usage) {
        if (!this.includeCost) {
            return null;
        }
        await this.ensurePricingLoaded();
        const pricing = await this.getModelPricing(model);
        if (!pricing) {
            return null;
        }
        const cached = usage.prompt_cached_tokens ?? 0;
        const uncachedPrompt = usage.prompt_tokens - cached;
        return {
            new_prompt_tokens: usage.prompt_tokens,
            new_prompt_cost: uncachedPrompt * (pricing.input_cost_per_token ?? 0),
            prompt_read_cached_tokens: cached || null,
            prompt_read_cached_cost: cached
                ? cached * (pricing.cache_read_input_token_cost ?? 0)
                : null,
            prompt_cached_creation_tokens: usage.prompt_cache_creation_tokens ?? null,
            prompt_cache_creation_cost: usage.prompt_cache_creation_tokens &&
                pricing.cache_creation_input_token_cost
                ? usage.prompt_cache_creation_tokens *
                    pricing.cache_creation_input_token_cost
                : null,
            completion_tokens: usage.completion_tokens,
            completion_cost: usage.completion_tokens * (pricing.output_cost_per_token ?? 0),
        };
    }
    async getModelPricing(modelName) {
        const customPricing = CUSTOM_MODEL_PRICING[modelName];
        if (customPricing) {
            return {
                model: modelName,
                input_cost_per_token: customPricing.input_cost_per_token ?? null,
                output_cost_per_token: customPricing.output_cost_per_token ?? null,
                cache_read_input_token_cost: customPricing.cache_read_input_token_cost ?? null,
                cache_creation_input_token_cost: customPricing.cache_creation_input_token_cost ?? null,
                max_tokens: customPricing.max_tokens ?? null,
                max_input_tokens: customPricing.max_input_tokens ?? null,
                max_output_tokens: customPricing.max_output_tokens ?? null,
            };
        }
        await this.ensurePricingLoaded();
        if (!this.pricingData) {
            return null;
        }
        const litellmModelName = MODEL_TO_LITELLM[modelName] ?? modelName;
        const pricing = this.pricingData[litellmModelName];
        if (!pricing) {
            return null;
        }
        return {
            model: modelName,
            input_cost_per_token: pricing.input_cost_per_token ?? null,
            output_cost_per_token: pricing.output_cost_per_token ?? null,
            cache_read_input_token_cost: pricing.cache_read_input_token_cost ?? null,
            cache_creation_input_token_cost: pricing.cache_creation_input_token_cost ?? null,
            max_tokens: pricing.max_tokens ?? null,
            max_input_tokens: pricing.max_input_tokens ?? null,
            max_output_tokens: pricing.max_output_tokens ?? null,
        };
    }
    get_usage_tokens_for_model(model) {
        const filtered = this.usageHistory.filter((entry) => entry.model === model);
        return {
            model,
            prompt_tokens: filtered.reduce((sum, entry) => sum + entry.usage.prompt_tokens, 0),
            prompt_cached_tokens: filtered.reduce((sum, entry) => sum + (entry.usage.prompt_cached_tokens ?? 0), 0),
            completion_tokens: filtered.reduce((sum, entry) => sum + entry.usage.completion_tokens, 0),
            total_tokens: filtered.reduce((sum, entry) => sum + entry.usage.prompt_tokens + entry.usage.completion_tokens, 0),
        };
    }
    async get_usage_summary(model, since) {
        let entries = this.usageHistory;
        if (model) {
            entries = entries.filter((entry) => entry.model === model);
        }
        if (since) {
            entries = entries.filter((entry) => entry.timestamp >= since);
        }
        if (!entries.length) {
            return {
                total_prompt_tokens: 0,
                total_prompt_cost: 0,
                total_prompt_cached_tokens: 0,
                total_prompt_cached_cost: 0,
                total_completion_tokens: 0,
                total_completion_cost: 0,
                total_tokens: 0,
                total_cost: 0,
                entry_count: 0,
                by_model: {},
            };
        }
        const byModel = {};
        let totalPrompt = 0;
        let totalCompletion = 0;
        let totalPromptCached = 0;
        let totalPromptCachedCost = 0;
        let totalPromptCost = 0;
        let totalCompletionCost = 0;
        for (const entry of entries) {
            const stats = (byModel[entry.model] ||= {
                model: entry.model,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                cost: 0,
                invocations: 0,
                average_tokens_per_invocation: 0,
            });
            stats.prompt_tokens += entry.usage.prompt_tokens;
            stats.completion_tokens += entry.usage.completion_tokens;
            const totalEntryTokens = entry.usage.prompt_tokens + entry.usage.completion_tokens;
            stats.total_tokens += totalEntryTokens;
            stats.invocations += 1;
            totalPrompt += entry.usage.prompt_tokens;
            totalCompletion += entry.usage.completion_tokens;
            totalPromptCached += entry.usage.prompt_cached_tokens ?? 0;
            if (this.includeCost) {
                const cost = await this.calculateCost(entry.model, entry.usage);
                const promptCost = usagePromptCost(cost);
                const completionCost = cost?.completion_cost ?? 0;
                const cachedCost = cost?.prompt_read_cached_cost ?? 0;
                stats.cost += promptCost + completionCost;
                totalPromptCost += promptCost;
                totalCompletionCost += completionCost;
                totalPromptCachedCost += cachedCost;
            }
        }
        Object.values(byModel).forEach((stats) => {
            stats.average_tokens_per_invocation = stats.invocations
                ? stats.total_tokens / stats.invocations
                : 0;
        });
        return {
            total_prompt_tokens: totalPrompt,
            total_prompt_cost: totalPromptCost,
            total_prompt_cached_tokens: totalPromptCached,
            total_prompt_cached_cost: totalPromptCachedCost,
            total_completion_tokens: totalCompletion,
            total_completion_cost: totalCompletionCost,
            total_tokens: totalPrompt + totalCompletion,
            total_cost: totalPromptCost + totalCompletionCost,
            entry_count: entries.length,
            by_model: byModel,
        };
    }
    async log_usage_summary() {
        if (!this.usageHistory.length)
            return;
        const summary = await this.get_usage_summary();
        if (!summary.entry_count)
            return;
        const totalTokens = this.formatTokens(summary.total_tokens);
        const totalCostPart = this.includeCost && summary.total_cost > 0
            ? ` ($${summary.total_cost.toFixed(4)})`
            : '';
        const promptTokens = this.formatTokens(summary.total_prompt_tokens);
        const promptCostPart = this.includeCost && summary.total_prompt_cost > 0
            ? ` ($${summary.total_prompt_cost.toFixed(4)})`
            : '';
        const completionTokens = this.formatTokens(summary.total_completion_tokens);
        const completionCostPart = this.includeCost && summary.total_completion_cost > 0
            ? ` ($${summary.total_completion_cost.toFixed(4)})`
            : '';
        costLogger.debug(`💲 ${ansi.bold}Total Usage Summary${ansi.reset}: ${ansi.blue}${totalTokens} tokens${ansi.reset}${totalCostPart} | ` +
            `⬅️ ${ansi.yellow}${promptTokens}${promptCostPart}${ansi.reset} | ➡️ ${ansi.green}${completionTokens}${completionCostPart}${ansi.reset}`);
        for (const [model, stats] of Object.entries(summary.by_model)) {
            const totalFmt = this.formatTokens(stats.total_tokens);
            const promptFmt = this.formatTokens(stats.prompt_tokens);
            const completionFmt = this.formatTokens(stats.completion_tokens);
            const avgFmt = this.formatTokens(Math.round(stats.average_tokens_per_invocation));
            const costPart = this.includeCost && stats.cost > 0
                ? ` ($${stats.cost.toFixed(4)})`
                : '';
            costLogger.debug(`  🤖 ${ansi.cyan}${model}${ansi.reset}: ${ansi.blue}${totalFmt} tokens${ansi.reset}${costPart} | ` +
                `⬅️ ${ansi.yellow}${promptFmt}${ansi.reset} | ➡️ ${ansi.green}${completionFmt}${ansi.reset} | ` +
                `📞 ${stats.invocations} calls | 📈 ${avgFmt}/call`);
        }
    }
    get_cost_by_model = async () => {
        const summary = await this.get_usage_summary();
        return summary.by_model;
    };
    clear_history() {
        this.usageHistory = [];
    }
    async refresh_pricing_data() {
        if (!this.includeCost)
            return;
        await this.fetchAndCachePricing();
    }
    async clean_old_caches(keepCount = 3) {
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            const jsonFiles = files.filter((file) => file.endsWith('.json'));
            if (jsonFiles.length <= keepCount)
                return;
            const sorted = jsonFiles
                .map((file) => path.join(this.cacheDir, file))
                .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
            const toDelete = sorted.slice(0, sorted.length - keepCount);
            await Promise.all(toDelete.map((file) => fs.promises.unlink(file).catch(() => undefined)));
        }
        catch (error) {
            logger.debug(`Failed to clean token cache: ${error.message}`);
        }
    }
    async ensurePricingLoaded() {
        if (!this.includeCost || this.pricingData)
            return;
        await this.loadPricingData();
    }
    estimateTokens(text) {
        return encode(text).length;
    }
}

import { createRequire } from 'node:module';
import { config as loadEnv } from 'dotenv';
import { createLogger } from './logging-config.js';
loadEnv();
const require = createRequire(import.meta.url);
const logger = createLogger('browser_use.observability');
let lmnrObserve = null;
let lmnrAvailable = false;
try {
    const lmnr = require('lmnr');
    if (typeof lmnr?.observe === 'function') {
        lmnrObserve = (options) => lmnr.observe(options);
        lmnrAvailable = true;
        if (process.env.BROWSER_USE_VERBOSE_OBSERVABILITY?.toLowerCase() === 'true') {
            logger.debug('Lmnr is available for observability');
        }
    }
}
catch (error) {
    lmnrObserve = null;
    lmnrAvailable = false;
    if (process.env.BROWSER_USE_VERBOSE_OBSERVABILITY?.toLowerCase() === 'true') {
        logger.debug(`Lmnr is not available for observability (${error.message})`);
    }
}
const isDebugModeEnv = () => process.env.LMNR_LOGGING_LEVEL?.toLowerCase() === 'debug';
const createNoopDecorator = () => (fn) => fn;
const normalizeOptions = (options = {}) => ({
    name: options.name ?? null,
    ignoreInput: options.ignoreInput ?? false,
    ignoreOutput: options.ignoreOutput ?? false,
    metadata: options.metadata ?? null,
    spanType: options.spanType ?? 'DEFAULT',
    ...options,
});
export const observe = (options = {}) => {
    const normalized = normalizeOptions({
        tags: ['observe', 'observe_debug'],
        ...options,
    });
    if (lmnrAvailable && lmnrObserve) {
        return lmnrObserve(normalized);
    }
    return createNoopDecorator();
};
export const observeDebug = (options = {}) => {
    const normalized = normalizeOptions({
        tags: ['observe_debug'],
        ...options,
    });
    if (lmnrAvailable && lmnrObserve && isDebugModeEnv()) {
        return lmnrObserve(normalized);
    }
    return createNoopDecorator();
};
export const observe_debug = observeDebug;
export const isLmnrAvailable = () => lmnrAvailable;
export const isDebugMode = () => isDebugModeEnv();
export const getObservabilityStatus = () => ({
    lmnrAvailable,
    debugMode: isDebugModeEnv(),
    observeActive: lmnrAvailable,
    observeDebugActive: lmnrAvailable && isDebugModeEnv(),
});

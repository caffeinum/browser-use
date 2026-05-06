import type { AgentHistoryList, DetectedVariable } from './views.js';
import type { DOMHistoryElement } from '../dom/history-tree-processor/view.js';
export declare const detect_variables_in_history: (history: AgentHistoryList | {
    history: any[];
}) => Record<string, DetectedVariable>;
export declare const substitute_in_dict: (data: Record<string, unknown>, replacements: Record<string, string>) => number;
export declare const _private_for_tests: {
    detectFromAttributes: (attributes: Record<string, string>) => [string, string | null] | null;
    detectFromValuePattern: (value: string) => [string, string | null] | null;
    detectVariableType: (value: string, element: DOMHistoryElement | null) => [string, string | null] | null;
    ensureUniqueName: (baseName: string, existing: Record<string, DetectedVariable>) => string;
};

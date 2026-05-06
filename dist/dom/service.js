var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../logging-config.js';
import { observe_debug } from '../observability.js';
import { time_execution_async } from '../utils.js';
import { is_new_tab_page } from '../utils.js';
import { DOMElementNode, DOMState, DOMTextNode, } from './views.js';
const DOM_TREE_SCRIPT = fs.readFileSync(fileURLToPath(new URL('./dom_tree/index.js', import.meta.url)), 'utf-8');
export class DomService {
    page;
    logger;
    jsCode;
    constructor(page, logger = createLogger('browser_use.dom.service')) {
        this.page = page;
        this.logger = logger;
        this.jsCode = DOM_TREE_SCRIPT;
    }
    // @ts-ignore - Decorator type mismatch with TypeScript strict mode
    async get_clickable_elements(highlight_elements = true, focus_element = -1, viewport_expansion = 0) {
        const [element_tree, selector_map] = await this._build_dom_tree(highlight_elements, focus_element, viewport_expansion);
        return new DOMState(element_tree, selector_map);
    }
    // @ts-ignore - Decorator type mismatch with TypeScript strict mode
    async get_cross_origin_iframes() {
        const hiddenFrameUrls = await this.page
            .locator('iframe')
            .evaluateAll((elements) => elements
            .filter((el) => {
            const element = el;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (style.visibility === 'hidden' ||
                style.display === 'none' ||
                rect.width === 0 ||
                rect.height === 0);
        })
            .map((el) => el.src));
        const currentHost = this.safeHostname(this.getPageUrl());
        return this.getFrames()
            .map((frame) => this.getFrameUrl(frame))
            .filter((url) => {
            if (!url)
                return false;
            const host = this.safeHostname(url);
            if (!host)
                return false;
            if (host === currentHost)
                return false;
            if (hiddenFrameUrls.includes(url))
                return false;
            return !this.isAdUrl(url);
        });
    }
    // @ts-ignore - Decorator type mismatch with TypeScript strict mode
    async _build_dom_tree(highlight_elements, focus_element, viewport_expansion) {
        const canEvaluate = await this.page.evaluate(() => 1 + 1);
        if (canEvaluate !== 2) {
            throw new Error('The page cannot evaluate JavaScript code properly');
        }
        const pageUrl = this.getPageUrl();
        if (is_new_tab_page(pageUrl) || pageUrl.startsWith('chrome://')) {
            return [
                new DOMElementNode(false, null, 'body', '', {}, []),
                {},
            ];
        }
        const args = {
            doHighlightElements: highlight_elements,
            focusHighlightIndex: focus_element,
            viewportExpansion: viewport_expansion,
            debugMode: this.isDebugEnabled(),
        };
        let eval_page;
        try {
            this.logger.debug(`🔧 Starting JavaScript DOM analysis for ${pageUrl.slice(0, 50)}...`);
            eval_page = await this.page.evaluate(({ script, evaluateArgs }) => {
                const fn = eval(script);
                return fn(evaluateArgs);
            }, { script: this.jsCode, evaluateArgs: args });
            this.logger.debug('✅ JavaScript DOM analysis completed');
        }
        catch (error) {
            this.logger.error(`Error evaluating DOMTree: ${error.message}`);
            throw error;
        }
        if (args.debugMode && eval_page.perfMetrics) {
            const perf = eval_page.perfMetrics;
            const totalNodes = perf?.nodeMetrics?.totalNodes ?? 0;
            let interactiveCount = 0;
            if (eval_page.map) {
                for (const node of Object.values(eval_page.map)) {
                    if (node?.isInteractive) {
                        interactiveCount += 1;
                    }
                }
            }
            this.logger.debug(`🔎 Ran buildDOMTree.js interactive element detection on: ${pageUrl.slice(0, 50)} interactive=${interactiveCount}/${totalNodes}`);
        }
        this.logger.debug('🔄 Starting DOM tree construction...');
        const result = await this._construct_dom_tree(eval_page);
        this.logger.debug('✅ DOM tree construction completed');
        return result;
    }
    // @ts-ignore - Decorator type mismatch with TypeScript strict mode
    async _construct_dom_tree(eval_page) {
        const selector_map = {};
        const node_map = new Map();
        const child_index = new Map();
        for (const [id, node_data] of Object.entries(eval_page.map)) {
            const [node, children] = this._parse_node(node_data);
            if (!node)
                continue;
            node_map.set(id, node);
            child_index.set(id, children);
            if (node instanceof DOMElementNode &&
                node.highlight_index !== null &&
                node.highlight_index !== undefined) {
                selector_map[node.highlight_index] = node;
            }
        }
        for (const [id, childrenIds] of child_index.entries()) {
            const parentNode = node_map.get(id);
            if (!(parentNode instanceof DOMElementNode))
                continue;
            for (const childId of childrenIds || []) {
                const key = String(childId);
                const childNode = node_map.get(key);
                if (!childNode)
                    continue;
                childNode.parent = parentNode;
                parentNode.children.push(childNode);
            }
        }
        const rootNode = node_map.get(String(eval_page.rootId));
        if (!(rootNode instanceof DOMElementNode)) {
            throw new Error('Failed to construct DOM tree');
        }
        return [rootNode, selector_map];
    }
    _parse_node(node_data) {
        if (!node_data) {
            return [null, []];
        }
        if (node_data.type === 'TEXT_NODE') {
            const textNode = new DOMTextNode(node_data.isVisible ?? false, null, node_data.text ?? '');
            return [textNode, []];
        }
        const children = Array.isArray(node_data.children)
            ? node_data.children
            : [];
        const tag = node_data.tagName ?? 'div';
        const xpath = node_data.xpath ?? '';
        const attributes = node_data.attributes ?? {};
        const element = new DOMElementNode(node_data.isVisible ?? false, null, tag, xpath, attributes, []);
        element.is_interactive = Boolean(node_data.isInteractive);
        element.is_top_element = Boolean(node_data.isTopElement);
        element.is_in_viewport = Boolean(node_data.isInViewport);
        element.shadow_root = Boolean(node_data.shadowRoot);
        element.highlight_index =
            node_data.highlightIndex === undefined ||
                node_data.highlightIndex === null
                ? null
                : Number(node_data.highlightIndex);
        element.page_coordinates = node_data.pageCoordinates ?? null;
        element.viewport_coordinates =
            node_data.viewportCoordinates ?? null;
        element.viewport_info = node_data.viewportInfo ?? null;
        element.is_new = node_data.isNew ?? null;
        return [element, children];
    }
    safeHostname(url) {
        if (!url)
            return '';
        try {
            return new URL(url).hostname;
        }
        catch {
            return '';
        }
    }
    getFrames() {
        const frames = this.page.frames;
        return typeof frames === 'function'
            ? frames.call(this.page)
            : (frames ?? []);
    }
    getFrameUrl(frame) {
        return typeof frame.url === 'function' ? frame.url() : (frame.url ?? '');
    }
    isAdUrl(url) {
        const host = this.safeHostname(url);
        return ['doubleclick.net', 'adroll.com', 'googletagmanager.com'].some((domain) => host.endsWith(domain));
    }
    getPageUrl() {
        return typeof this.page.url === 'function'
            ? this.page.url()
            : (this.page.url ?? '');
    }
    isDebugEnabled() {
        return ((process.env.BROWSER_USE_LOGGING_LEVEL ?? '').toLowerCase() === 'debug');
    }
    static detect_pagination_buttons(selector_map) {
        const paginationButtons = [];
        const nextPatterns = [
            'next',
            '>',
            '>>',
            'siguiente',
            'suivant',
            'weiter',
            'volgende',
        ];
        const prevPatterns = [
            'prev',
            'previous',
            '<',
            '<<',
            'anterior',
            'precedent',
            'zuruck',
            'vorige',
        ];
        const firstPatterns = ['first', 'primera', 'premiere', 'erste'];
        const lastPatterns = ['last', 'ultima', 'dernier', 'letzte'];
        const hasPattern = (text, patterns) => patterns.some((pattern) => text.includes(pattern));
        for (const [index, node] of Object.entries(selector_map)) {
            if (!(node instanceof DOMElementNode)) {
                continue;
            }
            const text = node.get_all_text_till_next_clickable_element().trim();
            const textLower = text.toLowerCase();
            const ariaLabel = String(node.attributes?.['aria-label'] ?? '').toLowerCase();
            const title = String(node.attributes?.title ?? '').toLowerCase();
            const className = String(node.attributes?.class ?? '').toLowerCase();
            const role = String(node.attributes?.role ?? '').toLowerCase();
            const allText = `${textLower} ${ariaLabel} ${title} ${className}`.trim();
            const disabledRaw = node.attributes?.disabled;
            const ariaDisabledRaw = node.attributes?.['aria-disabled'];
            const disabledAttr = typeof disabledRaw === 'string' ? disabledRaw.toLowerCase() : '';
            const ariaDisabled = typeof ariaDisabledRaw === 'string'
                ? ariaDisabledRaw.toLowerCase()
                : '';
            const isDisabled = (typeof disabledRaw === 'string' &&
                disabledAttr !== '' &&
                disabledAttr !== 'false') ||
                ariaDisabled === 'true' ||
                className.includes('disabled');
            let buttonType = null;
            if (hasPattern(allText, nextPatterns)) {
                buttonType = 'next';
            }
            else if (hasPattern(allText, prevPatterns)) {
                buttonType = 'prev';
            }
            else if (hasPattern(allText, firstPatterns)) {
                buttonType = 'first';
            }
            else if (hasPattern(allText, lastPatterns)) {
                buttonType = 'last';
            }
            else if (/^\d{1,2}$/.test(textLower) &&
                (role === 'button' || role === 'link' || role === '')) {
                buttonType = 'page_number';
            }
            if (!buttonType) {
                continue;
            }
            paginationButtons.push({
                button_type: buttonType,
                backend_node_id: Number(index),
                text: text || ariaLabel || title || node.tag_name,
                selector: node.xpath,
                is_disabled: isDisabled,
            });
        }
        return paginationButtons;
    }
}
__decorate([
    observe_debug({
        ignore_input: true,
        ignore_output: true,
        name: 'get_clickable_elements',
    })
    // @ts-ignore - Decorator type mismatch with TypeScript strict mode
    ,
    time_execution_async('--get_clickable_elements')
], DomService.prototype, "get_clickable_elements", null);
__decorate([
    time_execution_async('--get_cross_origin_iframes')
], DomService.prototype, "get_cross_origin_iframes", null);
__decorate([
    time_execution_async('--build_dom_tree')
], DomService.prototype, "_build_dom_tree", null);
__decorate([
    time_execution_async('--construct_dom_tree')
], DomService.prototype, "_construct_dom_tree", null);

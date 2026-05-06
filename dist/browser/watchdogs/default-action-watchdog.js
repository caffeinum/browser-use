import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ClickCoordinateEvent, ClickElementEvent, CloseTabEvent, FileDownloadedEvent, GetDropdownOptionsEvent, GoBackEvent, GoForwardEvent, NavigateToUrlEvent, RefreshEvent, ScrollEvent, ScrollToTextEvent, SelectDropdownOptionEvent, SendKeysEvent, SwitchTabEvent, TypeTextEvent, UploadFileEvent, WaitEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class DefaultActionWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        NavigateToUrlEvent,
        SwitchTabEvent,
        CloseTabEvent,
        GoBackEvent,
        GoForwardEvent,
        RefreshEvent,
        WaitEvent,
        SendKeysEvent,
        ScrollEvent,
        ScrollToTextEvent,
        ClickElementEvent,
        TypeTextEvent,
        UploadFileEvent,
        ClickCoordinateEvent,
        GetDropdownOptionsEvent,
        SelectDropdownOptionEvent,
    ];
    async on_NavigateToUrlEvent(event) {
        if (event.new_tab) {
            await this.browser_session.create_new_tab(event.url, {
                wait_until: event.wait_until,
                timeout_ms: event.timeout_ms,
            });
            return;
        }
        await this.browser_session.navigate_to(event.url, {
            wait_until: event.wait_until,
            timeout_ms: event.timeout_ms,
        });
    }
    async on_SwitchTabEvent(event) {
        let identifier;
        if (event.target_id) {
            identifier = event.target_id;
        }
        else {
            const tabs = this.browser_session.tabs;
            if (tabs.length === 0) {
                await this.browser_session.create_new_tab('about:blank');
                return (this.browser_session.active_tab?.target_id ??
                    this.browser_session.active_tab?.tab_id ??
                    'unknown_target');
            }
            const latestTab = tabs[tabs.length - 1];
            identifier = latestTab.target_id ?? latestTab.tab_id ?? latestTab.page_id;
        }
        const page = await this.browser_session.switch_to_tab(identifier);
        const activeTargetId = this.browser_session.active_tab?.target_id ?? null;
        return (activeTargetId ?? (page ? this.browser_session.active_tab?.tab_id : null));
    }
    async on_CloseTabEvent(event) {
        await this.browser_session.close_tab(event.target_id);
    }
    async on_GoBackEvent() {
        await this.browser_session.go_back();
    }
    async on_GoForwardEvent() {
        await this.browser_session.go_forward();
    }
    async on_RefreshEvent() {
        await this.browser_session.refresh();
    }
    async on_WaitEvent(event) {
        const seconds = Math.min(Math.max(event.seconds, 0), event.max_seconds);
        await this.browser_session.wait(seconds);
    }
    async on_SendKeysEvent(event) {
        await this.browser_session.send_keys(event.keys);
    }
    async on_ScrollEvent(event) {
        await this.browser_session.scroll(event.direction, event.amount, {
            node: event.node ?? null,
        });
    }
    async on_ScrollToTextEvent(event) {
        await this.browser_session.scroll_to_text(event.text, {
            direction: event.direction,
        });
    }
    async on_ClickElementEvent(event) {
        if (this.browser_session.is_file_input(event.node)) {
            return {
                validation_error: 'The target element is a file input. Use upload_file action instead of click.',
            };
        }
        if (this._isPrintRelatedElement(event.node)) {
            const pdfPath = await this._handlePrintButtonClick();
            if (pdfPath) {
                return pdfPath;
            }
        }
        return this.browser_session._click_element_node(event.node);
    }
    async on_ClickCoordinateEvent(event) {
        await this.browser_session.click_coordinates(event.coordinate_x, event.coordinate_y, {
            button: event.button,
        });
        return {
            coordinate_x: event.coordinate_x,
            coordinate_y: event.coordinate_y,
        };
    }
    async on_TypeTextEvent(event) {
        return this.browser_session._input_text_element_node(event.node, event.text, {
            clear: event.clear,
        });
    }
    async on_UploadFileEvent(event) {
        await this.browser_session.upload_file(event.node, event.file_path);
    }
    async on_GetDropdownOptionsEvent(event) {
        return this.browser_session.get_dropdown_options(event.node);
    }
    async on_SelectDropdownOptionEvent(event) {
        return this.browser_session.select_dropdown_option(event.node, event.text);
    }
    _isPrintRelatedElement(node) {
        if (!node || typeof node !== 'object') {
            return false;
        }
        const attributes = 'attributes' in node && node.attributes
            ? node.attributes
            : {};
        const onclick = String(attributes.onclick ?? '').toLowerCase();
        if (onclick.includes('print')) {
            return true;
        }
        const textMethods = [
            node.get_all_text_till_next_clickable_element,
            node.get_all_children_text,
        ];
        for (const textMethod of textMethods) {
            if (typeof textMethod !== 'function') {
                continue;
            }
            try {
                const text = String(textMethod.call(node, 2) ?? '').toLowerCase();
                if (text.includes('print')) {
                    return true;
                }
            }
            catch {
                // Ignore text extraction failures.
            }
        }
        return false;
    }
    async _handlePrintButtonClick() {
        const page = await this.browser_session.get_current_page();
        if (!page) {
            return null;
        }
        try {
            const cdpSession = await this.browser_session.get_or_create_cdp_session(page);
            const result = await cdpSession.send?.('Page.printToPDF', {
                printBackground: true,
                preferCSSPageSize: true,
            });
            const pdfBase64 = result && typeof result.data === 'string' ? result.data : null;
            if (!pdfBase64) {
                return null;
            }
            const downloadsPath = this.browser_session.browser_profile.downloads_path || os.tmpdir();
            fs.mkdirSync(downloadsPath, { recursive: true });
            const title = typeof page.title === 'function' ? await page.title() : 'document';
            const suggestedName = this._sanitizeFilename(`${title || 'document'}.pdf`);
            const uniqueFilename = await this._getUniqueFilename(downloadsPath, suggestedName);
            const finalPath = path.join(downloadsPath, uniqueFilename);
            const content = Buffer.from(pdfBase64, 'base64');
            fs.writeFileSync(finalPath, content);
            await this.event_bus.dispatch(new FileDownloadedEvent({
                guid: null,
                url: typeof page.url === 'function' ? page.url() : '',
                path: finalPath,
                file_name: uniqueFilename,
                file_size: content.length,
                file_type: 'pdf',
                mime_type: 'application/pdf',
                auto_download: false,
            }));
            return finalPath;
        }
        catch (error) {
            this.browser_session.logger.debug(`[DefaultActionWatchdog] Print-to-PDF failed: ${error.message}`);
            return null;
        }
    }
    async _getUniqueFilename(directory, filename) {
        const parsed = path.parse(filename);
        let candidate = filename;
        let counter = 1;
        while (fs.existsSync(path.join(directory, candidate))) {
            candidate = `${parsed.name} (${counter})${parsed.ext}`;
            counter += 1;
        }
        return candidate;
    }
    _sanitizeFilename(filename) {
        const sanitized = filename
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        return sanitized || 'document.pdf';
    }
}

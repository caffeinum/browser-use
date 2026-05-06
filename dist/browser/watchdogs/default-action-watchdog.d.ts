import { ClickCoordinateEvent, ClickElementEvent, CloseTabEvent, GetDropdownOptionsEvent, GoBackEvent, NavigateToUrlEvent, ScrollEvent, ScrollToTextEvent, SelectDropdownOptionEvent, SendKeysEvent, SwitchTabEvent, TypeTextEvent, UploadFileEvent, WaitEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class DefaultActionWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof ClickElementEvent | typeof ClickCoordinateEvent | typeof TypeTextEvent | typeof SwitchTabEvent | typeof GoBackEvent | typeof GetDropdownOptionsEvent)[];
    on_NavigateToUrlEvent(event: NavigateToUrlEvent): Promise<void>;
    on_SwitchTabEvent(event: SwitchTabEvent): Promise<string | null | undefined>;
    on_CloseTabEvent(event: CloseTabEvent): Promise<void>;
    on_GoBackEvent(): Promise<void>;
    on_GoForwardEvent(): Promise<void>;
    on_RefreshEvent(): Promise<void>;
    on_WaitEvent(event: WaitEvent): Promise<void>;
    on_SendKeysEvent(event: SendKeysEvent): Promise<void>;
    on_ScrollEvent(event: ScrollEvent): Promise<void>;
    on_ScrollToTextEvent(event: ScrollToTextEvent): Promise<void>;
    on_ClickElementEvent(event: ClickElementEvent): Promise<string | {
        validation_error: string;
    } | null>;
    on_ClickCoordinateEvent(event: ClickCoordinateEvent): Promise<{
        coordinate_x: number;
        coordinate_y: number;
    }>;
    on_TypeTextEvent(event: TypeTextEvent): Promise<void>;
    on_UploadFileEvent(event: UploadFileEvent): Promise<void>;
    on_GetDropdownOptionsEvent(event: GetDropdownOptionsEvent): Promise<{
        type: string;
        options: string;
        formatted_options: any;
        message: any;
        short_term_memory: any;
        long_term_memory: string;
    }>;
    on_SelectDropdownOptionEvent(event: SelectDropdownOptionEvent): Promise<{
        message: string;
        short_term_memory: string;
        long_term_memory: string;
        matched_text: string;
        matched_value: string;
    } | {
        message: string;
        short_term_memory: string;
        long_term_memory: string;
        matched_text: string;
        matched_value?: undefined;
    }>;
    private _isPrintRelatedElement;
    private _handlePrintButtonClick;
    private _getUniqueFilename;
    private _sanitizeFilename;
}

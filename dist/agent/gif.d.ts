import type { AgentHistoryList } from './views.js';
export declare const decode_unicode_escapes_to_utf8: (text: string) => string;
export declare const is_valid_gif_screenshot_candidate: (screenshot: string | null | undefined, pageUrl: string | null | undefined) => boolean;
export interface HistoryGifOptions {
    output_path?: string;
    duration?: number;
    show_goals?: boolean;
    show_task?: boolean;
    show_logo?: boolean;
    font_size?: number;
    title_font_size?: number;
    goal_font_size?: number;
    margin?: number;
    line_spacing?: number;
}
export declare const create_history_gif: (task: string, history: AgentHistoryList, { output_path, duration, show_goals, show_task, show_logo, font_size, title_font_size, goal_font_size, line_spacing, }?: HistoryGifOptions) => Promise<void>;

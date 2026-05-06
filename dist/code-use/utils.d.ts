export declare const truncate_message_content: (content: string, max_length?: number) => string;
export declare const detect_token_limit_issue: (completion: string, completion_tokens: number | null, max_tokens: number | null, stop_reason: string | null) => [boolean, string | null];
export declare const extract_url_from_task: (task: string) => string | null;
export declare const extract_code_blocks: (text: string) => Record<string, string>;

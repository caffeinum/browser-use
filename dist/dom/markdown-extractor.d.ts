export interface MarkdownContentStats {
    method: string;
    original_html_chars: number;
    initial_markdown_chars: number;
    filtered_chars_removed: number;
    final_filtered_chars: number;
    url?: string;
    started_from_char?: number;
    truncated_at_char?: number;
    next_start_char?: number;
    chunk_index?: number;
    total_chunks?: number;
}
export interface MarkdownChunk {
    content: string;
    chunk_index: number;
    total_chunks: number;
    char_offset_start: number;
    char_offset_end: number;
    overlap_prefix: string;
    has_more: boolean;
}
interface ExtractCleanMarkdownOptions {
    extract_links?: boolean;
    method?: string;
    url?: string;
}
export declare const preprocessMarkdownContent: (input: string, maxNewlines?: number) => {
    content: string;
    chars_filtered: number;
};
export declare const extractCleanMarkdownFromHtml: (html: string, options?: ExtractCleanMarkdownOptions) => {
    content: string;
    stats: MarkdownContentStats;
};
export declare const chunkMarkdownByStructure: (content: string, maxChunkChars?: number, overlapLines?: number, startFromChar?: number) => MarkdownChunk[];
export {};

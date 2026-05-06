export interface ExtractionResult {
    data: Record<string, unknown>;
    schema_used: Record<string, unknown>;
    is_partial?: boolean;
    source_url?: string | null;
    content_stats?: Record<string, unknown>;
}

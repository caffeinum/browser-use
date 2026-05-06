import TurndownService from 'turndown';
var BlockType;
(function (BlockType) {
    BlockType["Header"] = "header";
    BlockType["CodeFence"] = "code_fence";
    BlockType["Table"] = "table";
    BlockType["ListItem"] = "list_item";
    BlockType["Paragraph"] = "paragraph";
    BlockType["Blank"] = "blank";
})(BlockType || (BlockType = {}));
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)]) /;
const LIST_CONTINUATION_RE = /^(\s{2,}|\t)/;
const getBlockSize = (block) => block.char_end - block.char_start;
const blockText = (block) => block.lines.join('\n');
const getTableHeader = (block) => {
    if (block.block_type !== BlockType.Table || block.lines.length < 2) {
        return null;
    }
    const separator = block.lines[1] ?? '';
    if (separator.includes('---') || separator.includes('- -')) {
        return `${block.lines[0]}\n${separator}`;
    }
    return null;
};
export const preprocessMarkdownContent = (input, maxNewlines = 3) => {
    const originalLength = input.length;
    let content = input;
    content = content.replace(/`\{["\w][\s\S]*?\}`/g, '');
    content = content.replace(/\{"\$type":[^}]{100,}\}/g, '');
    content = content.replace(/\{"[^"]{5,}":\{[^}]{100,}\}/g, '');
    content = content.replace(/\n{4,}/g, '\n'.repeat(maxNewlines));
    const filteredLines = [];
    for (const line of content.split('\n')) {
        const stripped = line.trim();
        if (!stripped) {
            continue;
        }
        if ((stripped.startsWith('{') || stripped.startsWith('[')) &&
            stripped.length > 100) {
            continue;
        }
        filteredLines.push(line);
    }
    content = filteredLines.join('\n').trim();
    return {
        content,
        chars_filtered: originalLength - content.length,
    };
};
export const extractCleanMarkdownFromHtml = (html, options = {}) => {
    const method = options.method ?? 'html';
    const extractLinks = options.extract_links ?? false;
    let pageHtml = html;
    if (!extractLinks) {
        pageHtml = pageHtml
            .replace(/<a\b[^>]*>/gi, '')
            .replace(/<\/a>/gi, '')
            .replace(/<img\b[^>]*>/gi, '');
    }
    const originalHtmlLength = pageHtml.length;
    const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
    });
    turndown.remove(['script', 'style']);
    let content = turndown.turndown(pageHtml);
    const initialMarkdownLength = content.length;
    content = content.replace(/%[0-9A-Fa-f]{2}/g, '');
    const preprocessed = preprocessMarkdownContent(content);
    content = preprocessed.content;
    const stats = {
        method,
        original_html_chars: originalHtmlLength,
        initial_markdown_chars: initialMarkdownLength,
        filtered_chars_removed: preprocessed.chars_filtered,
        final_filtered_chars: content.length,
    };
    if (options.url) {
        stats.url = options.url;
    }
    return { content, stats };
};
const parseAtomicBlocks = (content) => {
    const lines = content.split('\n');
    const blocks = [];
    let i = 0;
    let offset = 0;
    while (i < lines.length) {
        const line = lines[i] ?? '';
        const lineLength = line.length + 1;
        if (!line.trim()) {
            blocks.push({
                block_type: BlockType.Blank,
                lines: [line],
                char_start: offset,
                char_end: offset + lineLength,
            });
            offset += lineLength;
            i += 1;
            continue;
        }
        if (line.trim().startsWith('```')) {
            const fenceLines = [line];
            let fenceEnd = offset + lineLength;
            i += 1;
            while (i < lines.length) {
                const fenceLine = lines[i] ?? '';
                const fenceLineLength = fenceLine.length + 1;
                fenceLines.push(fenceLine);
                fenceEnd += fenceLineLength;
                i += 1;
                if (fenceLine.trim().startsWith('```') && fenceLines.length > 1) {
                    break;
                }
            }
            blocks.push({
                block_type: BlockType.CodeFence,
                lines: fenceLines,
                char_start: offset,
                char_end: fenceEnd,
            });
            offset = fenceEnd;
            continue;
        }
        if (line.trimStart().startsWith('#')) {
            blocks.push({
                block_type: BlockType.Header,
                lines: [line],
                char_start: offset,
                char_end: offset + lineLength,
            });
            offset += lineLength;
            i += 1;
            continue;
        }
        if (TABLE_ROW_RE.test(line)) {
            const headerLines = [line];
            let headerEnd = offset + lineLength;
            i += 1;
            if (i < lines.length &&
                TABLE_ROW_RE.test(lines[i] ?? '') &&
                (lines[i] ?? '').includes('---')) {
                const separator = lines[i] ?? '';
                const separatorLength = separator.length + 1;
                headerLines.push(separator);
                headerEnd += separatorLength;
                i += 1;
            }
            blocks.push({
                block_type: BlockType.Table,
                lines: headerLines,
                char_start: offset,
                char_end: headerEnd,
            });
            offset = headerEnd;
            while (i < lines.length && TABLE_ROW_RE.test(lines[i] ?? '')) {
                const row = lines[i] ?? '';
                const rowLength = row.length + 1;
                blocks.push({
                    block_type: BlockType.Table,
                    lines: [row],
                    char_start: offset,
                    char_end: offset + rowLength,
                });
                offset += rowLength;
                i += 1;
            }
            continue;
        }
        if (LIST_ITEM_RE.test(line)) {
            const listLines = [line];
            let listEnd = offset + lineLength;
            i += 1;
            while (i < lines.length) {
                const nextLine = lines[i] ?? '';
                const nextLineLength = nextLine.length + 1;
                if (LIST_ITEM_RE.test(nextLine)) {
                    listLines.push(nextLine);
                    listEnd += nextLineLength;
                    i += 1;
                    continue;
                }
                if (nextLine.trim() && LIST_CONTINUATION_RE.test(nextLine)) {
                    listLines.push(nextLine);
                    listEnd += nextLineLength;
                    i += 1;
                    continue;
                }
                break;
            }
            blocks.push({
                block_type: BlockType.ListItem,
                lines: listLines,
                char_start: offset,
                char_end: listEnd,
            });
            offset = listEnd;
            continue;
        }
        const paragraphLines = [line];
        let paragraphEnd = offset + lineLength;
        i += 1;
        while (i < lines.length && (lines[i] ?? '').trim()) {
            const nextLine = lines[i] ?? '';
            if (nextLine.trimStart().startsWith('#') ||
                nextLine.trim().startsWith('```') ||
                TABLE_ROW_RE.test(nextLine) ||
                LIST_ITEM_RE.test(nextLine)) {
                break;
            }
            const nextLineLength = nextLine.length + 1;
            paragraphLines.push(nextLine);
            paragraphEnd += nextLineLength;
            i += 1;
        }
        blocks.push({
            block_type: BlockType.Paragraph,
            lines: paragraphLines,
            char_start: offset,
            char_end: paragraphEnd,
        });
        offset = paragraphEnd;
    }
    if (blocks.length > 0 && content && !content.endsWith('\n')) {
        const last = blocks[blocks.length - 1];
        blocks[blocks.length - 1] = {
            ...last,
            char_end: content.length,
        };
    }
    return blocks;
};
export const chunkMarkdownByStructure = (content, maxChunkChars = 100_000, overlapLines = 5, startFromChar = 0) => {
    if (!content) {
        return [
            {
                content: '',
                chunk_index: 0,
                total_chunks: 1,
                char_offset_start: 0,
                char_offset_end: 0,
                overlap_prefix: '',
                has_more: false,
            },
        ];
    }
    if (startFromChar >= content.length) {
        return [];
    }
    const blocks = parseAtomicBlocks(content);
    if (!blocks.length) {
        return [];
    }
    const rawChunks = [];
    let currentChunk = [];
    let currentSize = 0;
    for (const block of blocks) {
        const blockSize = getBlockSize(block);
        if (currentSize + blockSize > maxChunkChars && currentChunk.length > 0) {
            let bestSplit = currentChunk.length;
            for (let j = currentChunk.length - 1; j >= 1; j -= 1) {
                if (currentChunk[j]?.block_type === BlockType.Header) {
                    const prefixSize = currentChunk
                        .slice(0, j)
                        .reduce((sum, part) => sum + getBlockSize(part), 0);
                    if (prefixSize >= maxChunkChars * 0.5) {
                        bestSplit = j;
                        break;
                    }
                }
            }
            rawChunks.push(currentChunk.slice(0, bestSplit));
            currentChunk = currentChunk.slice(bestSplit);
            currentSize = currentChunk.reduce((sum, part) => sum + getBlockSize(part), 0);
        }
        currentChunk.push(block);
        currentSize += blockSize;
    }
    if (currentChunk.length > 0) {
        rawChunks.push(currentChunk);
    }
    const chunks = [];
    const totalChunks = rawChunks.length;
    let previousTableHeader = null;
    for (let index = 0; index < rawChunks.length; index += 1) {
        const chunkBlocks = rawChunks[index] ?? [];
        if (!chunkBlocks.length) {
            continue;
        }
        const chunkText = chunkBlocks.map(blockText).join('\n');
        const charStart = chunkBlocks[0]?.char_start ?? 0;
        const charEnd = chunkBlocks[chunkBlocks.length - 1]?.char_end ?? charStart;
        let overlapPrefix = '';
        if (index > 0) {
            const previousBlocks = rawChunks[index - 1] ?? [];
            const previousText = previousBlocks.map(blockText).join('\n');
            const previousLines = previousText.split('\n');
            const firstBlock = chunkBlocks[0];
            if (firstBlock?.block_type === BlockType.Table &&
                previousTableHeader !== null) {
                const trailingLines = overlapLines > 0 ? previousLines.slice(-overlapLines) : [];
                const headerLines = previousTableHeader.split('\n');
                const merged = [...headerLines];
                for (const trailing of trailingLines) {
                    if (!merged.includes(trailing)) {
                        merged.push(trailing);
                    }
                }
                overlapPrefix = merged.join('\n');
            }
            else if (overlapLines > 0) {
                overlapPrefix = previousLines.slice(-overlapLines).join('\n');
            }
        }
        for (const block of chunkBlocks) {
            if (block.block_type !== BlockType.Table) {
                continue;
            }
            const header = getTableHeader(block);
            if (header !== null) {
                previousTableHeader = header;
            }
        }
        chunks.push({
            content: chunkText,
            chunk_index: index,
            total_chunks: totalChunks,
            char_offset_start: charStart,
            char_offset_end: charEnd,
            overlap_prefix: overlapPrefix,
            has_more: index < totalChunks - 1,
        });
    }
    if (startFromChar > 0) {
        for (let index = 0; index < chunks.length; index += 1) {
            if ((chunks[index]?.char_offset_end ?? 0) > startFromChar) {
                return chunks.slice(index);
            }
        }
        return [];
    }
    return chunks;
};

export const truncate_message_content = (content, max_length = 10000) => {
    if (content.length <= max_length) {
        return content;
    }
    return `${content.slice(0, max_length)}\n\n[... truncated ${content.length - max_length} characters for history]`;
};
export const detect_token_limit_issue = (completion, completion_tokens, max_tokens, stop_reason) => {
    if (stop_reason === 'max_tokens') {
        return [true, `Response terminated due to max_tokens (${stop_reason})`];
    }
    if (completion_tokens != null &&
        max_tokens != null &&
        max_tokens > 0 &&
        completion_tokens / max_tokens >= 0.9) {
        return [
            true,
            `Response used ${(completion_tokens / max_tokens) * 100}% of max_tokens (${completion_tokens}/${max_tokens})`,
        ];
    }
    if (completion.length >= 6) {
        const last6 = completion.slice(-6);
        const repeated = completion.split(last6).length - 1;
        if (repeated >= 40) {
            return [
                true,
                `Repetitive output detected: last 6 chars "${last6}" appears ${repeated} times`,
            ];
        }
    }
    return [false, null];
};
export const extract_url_from_task = (task) => {
    const withoutEmails = task.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '');
    const matches = [];
    const patterns = [
        /https?:\/\/[^\s<>"']+/g,
        /(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?:\/[^\s<>"']*)?/g,
    ];
    for (const pattern of patterns) {
        const found = withoutEmails.match(pattern) ?? [];
        for (const entry of found) {
            const trimmed = entry.replace(/[.,;:!?()[\]]+$/g, '');
            matches.push(trimmed.startsWith('http://') || trimmed.startsWith('https://')
                ? trimmed
                : `https://${trimmed}`);
        }
    }
    const unique = [...new Set(matches)];
    if (unique.length !== 1) {
        return null;
    }
    return unique[0];
};
export const extract_code_blocks = (text) => {
    const blocks = {};
    const regex = /(`{3,})(\w+)(?:\s+(\w+))?\n([\s\S]*?)\1(?:\n|$)/g;
    let match;
    let pythonIndex = 0;
    while ((match = regex.exec(text)) != null) {
        const langRaw = match[2].toLowerCase();
        const name = match[3] ?? null;
        const content = match[4].replace(/\s+$/, '');
        if (!content) {
            continue;
        }
        const lang = langRaw === 'javascript' || langRaw === 'js'
            ? 'js'
            : langRaw === 'markdown' || langRaw === 'md'
                ? 'markdown'
                : langRaw === 'sh' || langRaw === 'shell'
                    ? 'bash'
                    : langRaw;
        if (!['python', 'js', 'bash', 'markdown'].includes(lang)) {
            continue;
        }
        if (name) {
            blocks[name] = content;
            continue;
        }
        if (lang === 'python') {
            blocks[`python_${pythonIndex}`] = content;
            pythonIndex += 1;
            continue;
        }
        blocks[lang] = content;
    }
    if (pythonIndex > 0) {
        blocks.python = blocks.python_0;
    }
    else {
        const genericMatches = [...text.matchAll(/```\n([\s\S]*?)```/g)].map((entry) => entry[1].trim());
        const generic = genericMatches.filter(Boolean).join('\n\n');
        if (generic) {
            blocks.python = generic;
        }
    }
    return blocks;
};

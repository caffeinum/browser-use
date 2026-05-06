const SPECIAL_PROTOCOLS = [
    'about:',
    'mailto:',
    'tel:',
    'ftp:',
    'file:',
    'data:',
    'javascript:',
];
export const normalize_url = (url) => {
    const normalized = url.trim();
    if (normalized.includes('://')) {
        return normalized;
    }
    if (SPECIAL_PROTOCOLS.some((protocol) => normalized.startsWith(protocol))) {
        return normalized;
    }
    return `https://${normalized}`;
};

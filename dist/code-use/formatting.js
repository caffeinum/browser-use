export const format_browser_state_for_llm = async (state, namespace, _browser_session) => {
    const lines = [];
    lines.push('## Browser State');
    lines.push(`**URL:** ${state.url}`);
    lines.push(`**Title:** ${state.title}`);
    lines.push('');
    const vars = Object.keys(namespace)
        .filter((key) => !key.startsWith('_'))
        .sort();
    lines.push(`**Available:** ${vars.length > 0 ? vars.join(', ') : '(none)'}`);
    lines.push('');
    const dom = typeof state.llm_representation === 'function'
        ? state.llm_representation()
        : '';
    lines.push('**DOM Structure:**');
    lines.push(dom || 'Empty DOM tree (you might have to wait for page load)');
    return lines.join('\n');
};

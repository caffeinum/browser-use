import { describe, expect, it } from 'vitest';
import { is_new_tab_page } from '../src/utils.js';

describe('is_new_tab_page alignment', () => {
  it('recognizes chrome://newtab URL variants', () => {
    expect(is_new_tab_page('chrome://newtab')).toBe(true);
    expect(is_new_tab_page('chrome://newtab/')).toBe(true);
  });

  it('recognizes about:newtab as a new tab URL', () => {
    expect(is_new_tab_page('about:newtab')).toBe(true);
  });

  it('keeps regular pages as non-new-tab URLs', () => {
    expect(is_new_tab_page('https://example.com')).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils.js', () => {
  let counter = 0;
  const decorator =
    <T extends (...args: any[]) => any>(_label?: string) =>
    (fn: T) =>
      fn;
  return {
    uuid7str: () => `uuid-${++counter}`,
    time_execution_sync: decorator,
    time_execution_async: decorator,
    SignalHandler: class {
      register() {}
      reset() {}
      unregister() {}
    },
    get_browser_use_version: () => 'test-version',
    is_new_tab_page: (url: string) =>
      url === 'about:blank' || url.startsWith('chrome://'),
    match_url_with_domain_pattern: () => false,
    merge_dicts: (a: any, b: any) => ({ ...a, ...b }),
    create_logger: () => ({
      debug: () => {},
      info: () => {},
      warning: () => {},
      error: () => {},
    }),
  };
});

import { Controller } from '../src/controller/service.js';

describe('input_text action description', () => {
  it('exposes a numeric index example so the LLM does not emit a boolean', () => {
    const controller = new Controller();
    const action = controller.registry.get_action('input_text');

    expect(action).not.toBeNull();
    const description = action!.description;

    expect(description).toMatch(/index/);
    expect(description).toMatch(/\{index:\s*\d+/);
  });
});

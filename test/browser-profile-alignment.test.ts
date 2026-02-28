import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const importProfileModule = async () => {
  vi.resetModules();
  return await import('../src/browser/profile.js');
};

describe('BrowserProfile alignment with latest py-browser-use defaults', () => {
  afterEach(() => {
    delete process.env.BROWSER_USE_DISABLE_EXTENSIONS;
  });

  it('defaults wait_between_actions to 0.1 seconds', async () => {
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({});
    expect(profile.config.wait_between_actions).toBe(0.1);
  });

  it('uses 1920x1080 fallback for deprecated window_width/window_height options', async () => {
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({
      window_width: 1600,
    });

    expect(profile.config.window_size?.width).toBe(1600);
    expect(profile.config.window_size?.height).toBe(1080);
  });

  it('keeps default extensions enabled when env var is unset', async () => {
    delete process.env.BROWSER_USE_DISABLE_EXTENSIONS;
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({});
    expect(profile.config.enable_default_extensions).toBe(true);
  });

  it('disables default extensions when BROWSER_USE_DISABLE_EXTENSIONS is truthy', async () => {
    process.env.BROWSER_USE_DISABLE_EXTENSIONS = '1';
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({});
    expect(profile.config.enable_default_extensions).toBe(false);
  });

  it('still enables default extensions for falsey env values', async () => {
    process.env.BROWSER_USE_DISABLE_EXTENSIONS = 'false';
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({});
    expect(profile.config.enable_default_extensions).toBe(true);
  });

  it('lets explicit constructor values override env defaults', async () => {
    process.env.BROWSER_USE_DISABLE_EXTENSIONS = '1';
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({
      enable_default_extensions: true,
    });
    expect(profile.config.enable_default_extensions).toBe(true);
  });

  it('optimizes large allowed/prohibited domain lists into sets', async () => {
    const { BrowserProfile } = await importProfileModule();
    const domains = Array.from({ length: 120 }, (_, idx) => {
      return `site-${idx}.example.com`;
    });

    const profile = new BrowserProfile({
      allowed_domains: domains,
      prohibited_domains: domains,
    });

    expect(profile.config.allowed_domains).toBeInstanceOf(Set);
    expect(profile.config.prohibited_domains).toBeInstanceOf(Set);
    expect(
      (profile.config.allowed_domains as Set<string>).has(domains[0])
    ).toBe(true);
  });

  it('creates a unique default downloads_path when none is provided', async () => {
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({});
    const downloadsPath = profile.config.downloads_path;

    expect(typeof downloadsPath).toBe('string');
    expect(downloadsPath).toContain('browser-use-downloads-');
    expect(fs.existsSync(downloadsPath!)).toBe(true);
  });

  it('preserves arg values containing equals signs', async () => {
    const { BrowserProfile } = await importProfileModule();
    const profile = new BrowserProfile({
      enable_default_extensions: false,
      args: ['--custom-size=1280,720', '--custom=bar=baz', '--custom-flag'],
    });

    const args = await profile.getArgs();
    expect(args).toContain('--custom-size=1280,720');
    expect(args).toContain('--custom=bar=baz');
    expect(args).toContain('--custom-flag');
  });
});

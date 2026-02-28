import { describe, expect, it } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import { BrowserProfile } from '../src/browser/profile.js';

describe('Allowed Domains Security', () => {
  it('blocks URLs that only contain allowed domains in query strings', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['example.com'],
      }),
    });

    const isAllowed = (session as any)._is_url_allowed(
      'https://evil.com/?next=https://example.com'
    );
    expect(isAllowed).toBe(false);
  });

  it('defaults to https-only matching when no scheme is specified', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['example.com'],
      }),
    });

    expect((session as any)._is_url_allowed('https://example.com')).toBe(true);
    expect((session as any)._is_url_allowed('http://example.com')).toBe(false);
  });

  it('supports explicit scheme wildcard patterns', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['http*://example.com'],
      }),
    });

    expect((session as any)._is_url_allowed('https://example.com')).toBe(true);
    expect((session as any)._is_url_allowed('http://example.com')).toBe(true);
  });

  it('blocks prohibited domains when allowlist is not configured', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        prohibited_domains: ['https://evil.com'],
      }),
    });

    expect((session as any)._is_url_allowed('https://evil.com')).toBe(false);
    expect((session as any)._is_url_allowed('https://example.com')).toBe(true);
  });

  it('lets allowed_domains take precedence over prohibited_domains', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['https://example.com'],
        prohibited_domains: ['https://example.com'],
      }),
    });

    expect((session as any)._is_url_allowed('https://example.com')).toBe(true);
    expect((session as any)._is_url_allowed('https://other.com')).toBe(false);
  });

  it('blocks ip-address URLs when block_ip_addresses is enabled', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        block_ip_addresses: true,
      }),
    });

    expect((session as any)._is_url_allowed('https://127.0.0.1')).toBe(false);
    expect((session as any)._is_url_allowed('https://[::1]')).toBe(false);
    expect((session as any)._is_url_allowed('https://example.com')).toBe(true);
  });

  it('uses optimized allowlist sets for large domain lists and matches www variants', () => {
    const domains = Array.from({ length: 120 }, (_, idx) => {
      return `site-${idx}.example.com`;
    });
    domains[0] = 'example.com';

    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: domains,
      }),
    });

    expect((session as any)._is_url_allowed('https://www.example.com')).toBe(
      true
    );
    expect((session as any)._is_url_allowed('http://www.example.com')).toBe(
      false
    );
    expect((session as any)._is_url_allowed('https://unknown.example')).toBe(
      false
    );
  });

  it('uses optimized prohibited sets for large blocklists', () => {
    const domains = Array.from({ length: 120 }, (_, idx) => {
      return `blocked-${idx}.example.com`;
    });
    domains[0] = 'evil.example.com';

    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        prohibited_domains: domains,
      }),
    });

    expect(
      (session as any)._is_url_allowed('https://www.evil.example.com')
    ).toBe(false);
    expect((session as any)._is_url_allowed('https://safe.example.com')).toBe(
      true
    );
  });

  it('keeps wildcard allowlist patterns functional for large lists', () => {
    const domains = Array.from({ length: 120 }, (_, idx) => {
      return `site-${idx}.example.com`;
    });
    domains[0] = '*.example.com';

    const profile = new BrowserProfile({
      allowed_domains: domains,
    });
    const session = new BrowserSession({
      browser_profile: profile,
    });

    expect(Array.isArray(profile.config.allowed_domains)).toBe(true);
    expect((session as any)._is_url_allowed('https://sub.example.com')).toBe(
      true
    );
  });

  it('keeps wildcard blocklist patterns functional for large lists', () => {
    const domains = Array.from({ length: 120 }, (_, idx) => {
      return `blocked-${idx}.example.com`;
    });
    domains[0] = '*.evil.test';

    const profile = new BrowserProfile({
      prohibited_domains: domains,
    });
    const session = new BrowserSession({
      browser_profile: profile,
    });

    expect(Array.isArray(profile.config.prohibited_domains)).toBe(true);
    expect((session as any)._is_url_allowed('https://sub.evil.test')).toBe(
      false
    );
  });
});

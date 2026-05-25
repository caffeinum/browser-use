import { BrowserConnectedEvent, BrowserErrorEvent } from '../events.js';
import { BaseWatchdog } from './base.js';

type BrowserCDPSessionLike = {
  send?: (method: string, params?: Record<string, unknown>) => Promise<any>;
  detach?: () => Promise<void>;
};

export class PermissionsWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [BrowserConnectedEvent];
  static override EMITS = [BrowserErrorEvent];

  async on_BrowserConnectedEvent() {
    const permissions = this.browser_session.browser_profile.config.permissions;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return;
    }

    const scopedOrigins = this._getScopedPermissionOrigins();
    if (scopedOrigins) {
      await this._grantScopedPermissions(permissions, scopedOrigins);
      return;
    }

    let cdpError: Error | null = null;
    try {
      const grantedWithCdp = await this._grantPermissionsViaCdp(permissions);
      if (grantedWithCdp) {
        return;
      }
    } catch (error) {
      cdpError = error as Error;
    }

    const context = this.browser_session.browser_context as {
      grantPermissions?: (
        permissions: string[],
        options?: { origin?: string }
      ) => Promise<void>;
    } | null;

    if (!context?.grantPermissions) {
      if (!cdpError) {
        return;
      }
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'PermissionsWatchdogError',
          message: cdpError.message || 'Failed to grant permissions via CDP',
          details: {
            permissions,
            mode: 'cdp',
          },
        })
      );
      return;
    }

    try {
      await context.grantPermissions(permissions);
    } catch (error) {
      const message = (error as Error).message ?? 'Failed to grant permissions';
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'PermissionsWatchdogError',
          message,
          details: {
            permissions,
            cdp_error: cdpError?.message ?? null,
            mode: 'playwright',
          },
        })
      );
    }
  }

  private async _grantScopedPermissions(
    permissions: string[],
    origins: string[]
  ) {
    if (origins.length === 0) {
      this.browser_session.logger.debug(
        '[PermissionsWatchdog] Domain restrictions are active; skipping global permission grants because no concrete allowed origins can be resolved.'
      );
      return;
    }

    const context = this.browser_session.browser_context as {
      grantPermissions?: (
        permissions: string[],
        options?: { origin?: string }
      ) => Promise<void>;
    } | null;

    for (const origin of origins) {
      let cdpError: Error | null = null;
      try {
        const grantedWithCdp = await this._grantPermissionsViaCdp(
          permissions,
          origin
        );
        if (grantedWithCdp) {
          continue;
        }
      } catch (error) {
        cdpError = error as Error;
      }

      if (!context?.grantPermissions) {
        if (cdpError) {
          await this._dispatchPermissionError(
            permissions,
            'cdp',
            cdpError,
            origin
          );
        }
        continue;
      }

      try {
        await context.grantPermissions(permissions, { origin });
      } catch (error) {
        await this._dispatchPermissionError(
          permissions,
          'playwright',
          error as Error,
          origin,
          cdpError
        );
      }
    }
  }

  private async _dispatchPermissionError(
    permissions: string[],
    mode: 'cdp' | 'playwright',
    error: Error,
    origin?: string,
    cdpError?: Error | null
  ) {
    await this.event_bus.dispatch(
      new BrowserErrorEvent({
        error_type: 'PermissionsWatchdogError',
        message: error.message ?? 'Failed to grant permissions',
        details: {
          permissions,
          cdp_error: cdpError?.message ?? null,
          mode,
          origin: origin ?? null,
        },
      })
    );
  }

  private _getScopedPermissionOrigins(): string[] | null {
    const session = this.browser_session as any;
    const hasRestrictions =
      typeof session._has_url_access_restrictions === 'function'
        ? session._has_url_access_restrictions()
        : false;
    if (!hasRestrictions) {
      return null;
    }

    const allowedDomains = this._domainCollectionToStrings(
      this.browser_session.browser_profile.allowed_domains
    );
    const origins = new Set<string>();
    for (const pattern of allowedDomains) {
      for (const origin of this._originsForAllowedPattern(pattern)) {
        const denialReason =
          typeof session._get_url_access_denial_reason === 'function'
            ? session._get_url_access_denial_reason(origin)
            : null;
        if (!denialReason) {
          origins.add(origin);
        }
      }
    }

    return [...origins];
  }

  private _domainCollectionToStrings(value: unknown): string[] {
    if (value instanceof Set) {
      return [...value].filter(
        (item): item is string => typeof item === 'string'
      );
    }
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    return [];
  }

  private _originsForAllowedPattern(pattern: string): string[] {
    const trimmed = pattern.trim();
    if (!trimmed || trimmed.includes('*')) {
      return [];
    }

    try {
      if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return [];
        }
        return [parsed.origin];
      }

      const parsed = new URL(`https://${trimmed}`);
      return [parsed.origin];
    } catch {
      return [];
    }
  }

  private async _grantPermissionsViaCdp(
    permissions: string[],
    origin?: string
  ) {
    const browser = this.browser_session.browser as {
      newBrowserCDPSession?: () => Promise<BrowserCDPSessionLike>;
    } | null;
    if (!browser?.newBrowserCDPSession) {
      return false;
    }

    const cdpSession = await browser.newBrowserCDPSession();
    try {
      const params: Record<string, unknown> = {
        permissions,
      };
      if (origin) {
        params.origin = origin;
      }
      await cdpSession.send?.('Browser.grantPermissions', params);
      return true;
    } finally {
      try {
        await cdpSession.detach?.();
      } catch {
        // Ignore detach failures.
      }
    }
  }
}

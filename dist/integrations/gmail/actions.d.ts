/**
 * Gmail Actions for Browser Use
 * Defines agent actions for Gmail integration including 2FA code retrieval,
 * email reading, and authentication management.
 */
import { GmailService } from './service.js';
import type { Tools } from '../../tools/service.js';
/**
 * Register Gmail actions with the provided tools registry
 */
export declare function registerGmailActions(tools: Tools, gmailService?: GmailService | null, accessToken?: string | null): Tools;
export declare const register_gmail_actions: typeof registerGmailActions;

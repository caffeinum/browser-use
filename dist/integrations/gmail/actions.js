/**
 * Gmail Actions for Browser Use
 * Defines agent actions for Gmail integration including 2FA code retrieval,
 * email reading, and authentication management.
 */
import { z } from 'zod';
import { createLogger } from '../../logging-config.js';
import { ActionResult } from '../../agent/views.js';
import { GmailService } from './service.js';
const logger = createLogger('browser_use.gmail.actions');
// Global Gmail service instance - initialized when actions are registered
let _gmailService = null;
// Schema for get_recent_emails action
const GetRecentEmailsParamsSchema = z.object({
    keyword: z
        .string()
        .default('')
        .describe('A single keyword for search, e.g. github, airbnb, etc.'),
    max_results: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(3)
        .describe('Maximum number of emails to retrieve (1-50, default: 3)'),
});
/**
 * Register Gmail actions with the provided tools registry
 */
export function registerGmailActions(tools, gmailService, accessToken) {
    // Use provided service or create a new one with access token if provided
    if (gmailService) {
        _gmailService = gmailService;
    }
    else if (accessToken) {
        _gmailService = new GmailService({ access_token: accessToken });
    }
    else {
        _gmailService = new GmailService();
    }
    // Register get_recent_emails action
    tools.registry.action('Get recent emails from the mailbox with a keyword to retrieve verification codes, OTP, 2FA tokens, magic links, or any recent email content. Keep your query a single keyword.', GetRecentEmailsParamsSchema)(async (params) => {
        try {
            if (!_gmailService) {
                throw new Error('Gmail service not initialized');
            }
            // Ensure authentication
            if (!_gmailService.isAuthenticated()) {
                logger.info('📧 Gmail not authenticated, attempting authentication...');
                const authenticated = await _gmailService.authenticate();
                if (!authenticated) {
                    return new ActionResult({
                        extracted_content: 'Failed to authenticate with Gmail. Please ensure Gmail credentials are set up properly.',
                        long_term_memory: 'Gmail authentication failed',
                    });
                }
            }
            // Use specified max_results (1-50, default 3), last 5 minutes
            const maxResults = params.max_results;
            const timeFilter = '5m';
            // Build query with time filter and optional user query
            const queryParts = [`newer_than:${timeFilter}`];
            if (params.keyword.trim()) {
                queryParts.push(params.keyword.trim());
            }
            const query = queryParts.join(' ');
            logger.info(`🔍 Gmail search query: ${query}`);
            // Get emails
            const emails = await _gmailService.getRecentEmails({
                max_results: maxResults,
                query: query,
                time_filter: timeFilter,
            });
            if (!emails.length) {
                const queryInfo = params.keyword.trim()
                    ? ` matching '${params.keyword}'`
                    : '';
                const memory = `No recent emails found from last ${timeFilter}${queryInfo}`;
                return new ActionResult({
                    extracted_content: memory,
                    long_term_memory: memory,
                });
            }
            // Format with full email content for large display
            let content = `Found ${emails.length} recent email${emails.length > 1 ? 's' : ''} from the last ${timeFilter}:\n\n`;
            for (let i = 0; i < emails.length; i++) {
                const email = emails[i];
                content += `Email ${i + 1}:\n`;
                content += `From: ${email.from}\n`;
                content += `Subject: ${email.subject}\n`;
                content += `Date: ${email.date}\n`;
                content += `Content:\n${email.body}\n`;
                content += '-'.repeat(50) + '\n\n';
            }
            logger.info(`📧 Retrieved ${emails.length} recent emails`);
            return new ActionResult({
                extracted_content: content,
                include_extracted_content_only_once: true,
                long_term_memory: `Retrieved ${emails.length} recent emails from last ${timeFilter} for query ${query}.`,
            });
        }
        catch (error) {
            logger.error(`Error getting recent emails: ${error.message || error}`);
            return new ActionResult({
                error: `Error getting recent emails: ${error.message || error}`,
                long_term_memory: 'Failed to get recent emails due to error',
            });
        }
    });
    return tools;
}
// Backward compatibility export
export const register_gmail_actions = registerGmailActions;

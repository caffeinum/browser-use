/**
 * Gmail API Service for Browser Use
 * Handles Gmail API authentication, email reading, and 2FA code extraction.
 * This service provides a clean interface for agents to interact with Gmail.
 */

import path from 'node:path';
import fs from 'node:fs';
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import { createLogger } from '../../logging-config.js';
import { CONFIG } from '../../config.js';

const logger = createLogger('browser_use.gmail');

const chmodPrivatePath = (targetPath: string, mode: number) => {
  if (process.platform === 'win32') {
    return;
  }
  try {
    fs.chmodSync(targetPath, mode);
  } catch {
    /* best effort */
  }
};

const ensurePrivateDirectory = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  chmodPrivatePath(dirPath, 0o700);
};

const readPrivateJsonFile = (filePath: string) => {
  chmodPrivatePath(filePath, 0o600);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writePrivateJsonFile = (filePath: string, value: unknown) => {
  fs.writeFileSync(filePath, JSON.stringify(value), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  chmodPrivatePath(filePath, 0o600);
};

export interface EmailData {
  id: string;
  thread_id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number;
  body: string;
  raw_message: gmail_v1.Schema$Message;
}

export class GmailService {
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  private configDir: string;
  private credentialsFile: string;
  private tokenFile: string;
  private accessToken: string | null;
  private service: gmail_v1.Gmail | null = null;
  private creds: any = null;
  private _authenticated = false;

  constructor(
    options: {
      credentials_file?: string;
      token_file?: string;
      config_dir?: string;
      access_token?: string;
    } = {}
  ) {
    // Set up configuration directory
    this.configDir = options.config_dir || CONFIG.BROWSER_USE_CONFIG_DIR;

    // Direct access token support
    this.accessToken = options.access_token || null;

    // Ensure config directory exists (only if not using direct token)
    if (!this.accessToken) {
      ensurePrivateDirectory(this.configDir);
    }

    // Set up credential paths
    this.credentialsFile =
      options.credentials_file ||
      path.join(this.configDir, 'gmail_credentials.json');
    this.tokenFile =
      options.token_file || path.join(this.configDir, 'gmail_token.json');
  }

  /**
   * Check if Gmail service is authenticated
   */
  isAuthenticated(): boolean {
    return this._authenticated && this.service !== null;
  }

  /**
   * Handle OAuth authentication and token management
   */
  async authenticate(): Promise<boolean> {
    try {
      logger.info('🔐 Authenticating with Gmail API...');

      // Check if using direct access token
      if (this.accessToken) {
        logger.info('🔑 Using provided access token');
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: this.accessToken });
        this.service = google.gmail({ version: 'v1', auth });
        this._authenticated = true;
        logger.info('✅ Gmail API ready with access token!');
        return true;
      }

      // Original file-based authentication flow
      // Try to load existing tokens
      if (fs.existsSync(this.tokenFile)) {
        const tokenData = readPrivateJsonFile(this.tokenFile);
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokenData);
        this.creds = auth;
        logger.debug('📁 Loaded existing tokens');
      }

      // If no valid credentials, run OAuth flow
      if (
        !this.creds ||
        !this.creds.credentials ||
        !this.creds.credentials.access_token
      ) {
        if (
          this.creds &&
          this.creds.credentials &&
          this.creds.credentials.refresh_token
        ) {
          logger.info('🔄 Refreshing expired tokens...');
          await this.creds.refreshAccessToken();
        } else {
          logger.info('🌐 Starting OAuth flow...');
          if (!fs.existsSync(this.credentialsFile)) {
            logger.error(
              `❌ Gmail credentials file not found: ${this.credentialsFile}\n` +
                'Please download it from Google Cloud Console:\n' +
                '1. Go to https://console.cloud.google.com/\n' +
                '2. APIs & Services > Credentials\n' +
                '3. Download OAuth 2.0 Client JSON\n' +
                `4. Save as 'gmail_credentials.json' in ${this.configDir}/`
            );
            return false;
          }

          const credentials = readPrivateJsonFile(this.credentialsFile);
          const { client_secret, client_id, redirect_uris } =
            credentials.installed || credentials.web;
          const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris[0]
          );

          const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: GmailService.SCOPES,
          });

          logger.info(`🔗 Please visit this URL to authorize:\n${authUrl}`);
          logger.info('⏳ Waiting for authorization code...');

          // Note: In a real implementation, you would use a web server to handle the OAuth callback
          // For now, we'll throw an error with instructions
          throw new Error(
            'OAuth flow requires manual intervention. Please:\n' +
              `1. Visit: ${authUrl}\n` +
              '2. Authorize the application\n' +
              '3. Copy the authorization code\n' +
              '4. Implement token exchange logic'
          );
        }

        // Save tokens for next time
        writePrivateJsonFile(this.tokenFile, this.creds.credentials);
        logger.info(`💾 Tokens saved to ${this.tokenFile}`);
      }

      // Build Gmail service
      this.service = google.gmail({ version: 'v1', auth: this.creds });
      this._authenticated = true;
      logger.info('✅ Gmail API ready!');
      return true;
    } catch (error) {
      logger.error(`❌ Gmail authentication failed: ${error}`);
      return false;
    }
  }

  /**
   * Get recent emails with optional query filter
   */
  async getRecentEmails(
    options: {
      max_results?: number;
      query?: string;
      time_filter?: string;
    } = {}
  ): Promise<EmailData[]> {
    const { max_results = 10, query = '', time_filter = '1h' } = options;

    if (!this.isAuthenticated()) {
      logger.error(
        '❌ Gmail service not authenticated. Call authenticate() first.'
      );
      return [];
    }

    try {
      // Add time filter to query if provided
      let fullQuery = query;
      if (time_filter && !query.includes('newer_than:')) {
        fullQuery = `newer_than:${time_filter} ${query}`.trim();
      }

      logger.info(`📧 Fetching ${max_results} recent emails...`);
      if (fullQuery) {
        logger.debug(`🔍 Query: ${fullQuery}`);
      }

      // Get message list
      const results = (await this.service!.users.messages.list({
        userId: 'me',
        maxResults: max_results,
        q: fullQuery,
      })) as any;

      const messages = results.data.messages || [];
      if (!messages.length) {
        logger.info('📭 No messages found');
        return [];
      }

      logger.info(`📨 Found ${messages.length} messages, fetching details...`);

      // Get full message details
      const emails: EmailData[] = [];
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        logger.debug(`📖 Reading email ${i + 1}/${messages.length}...`);

        const fullMessage = (await this.service!.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        })) as any;

        const emailData = this._parseEmail(fullMessage.data);
        emails.push(emailData);
      }

      return emails;
    } catch (error: any) {
      logger.error(`❌ Gmail API error: ${error.message || error}`);
      return [];
    }
  }

  /**
   * Parse Gmail message into readable format
   */
  private _parseEmail(message: gmail_v1.Schema$Message): EmailData {
    const headers = message.payload?.headers || [];
    const headerMap: Record<string, string> = {};
    for (const header of headers) {
      if (header.name && header.value) {
        headerMap[header.name] = header.value;
      }
    }

    return {
      id: message.id || '',
      thread_id: message.threadId || '',
      subject: headerMap['Subject'] || '',
      from: headerMap['From'] || '',
      to: headerMap['To'] || '',
      date: headerMap['Date'] || '',
      timestamp: parseInt(message.internalDate || '0'),
      body: this._extractBody(message.payload || {}),
      raw_message: message,
    };
  }

  /**
   * Extract email body from payload
   */
  private _extractBody(payload: gmail_v1.Schema$MessagePart): string {
    let body = '';

    if (payload.body?.data) {
      // Simple email body
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      // Multi-part email
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const partBody = Buffer.from(part.body.data, 'base64').toString(
            'utf-8'
          );
          body += partBody;
        } else if (part.mimeType === 'text/html' && !body && part.body?.data) {
          // Fallback to HTML if no plain text
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return body;
  }

  /**
   * Send an email
   */
  async sendMessage(
    to: string,
    subject: string,
    body: string
  ): Promise<gmail_v1.Schema$Message | null> {
    if (!this.isAuthenticated()) {
      logger.error('❌ Gmail service not authenticated.');
      return null;
    }

    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await this.service!.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return res.data;
    } catch (error: any) {
      logger.error(`❌ Failed to send email: ${error.message || error}`);
      return null;
    }
  }
}

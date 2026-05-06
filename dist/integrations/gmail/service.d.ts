/**
 * Gmail API Service for Browser Use
 * Handles Gmail API authentication, email reading, and 2FA code extraction.
 * This service provides a clean interface for agents to interact with Gmail.
 */
import type { gmail_v1 } from 'googleapis';
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
export declare class GmailService {
    private static readonly SCOPES;
    private configDir;
    private credentialsFile;
    private tokenFile;
    private accessToken;
    private service;
    private creds;
    private _authenticated;
    constructor(options?: {
        credentials_file?: string;
        token_file?: string;
        config_dir?: string;
        access_token?: string;
    });
    /**
     * Check if Gmail service is authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Handle OAuth authentication and token management
     */
    authenticate(): Promise<boolean>;
    /**
     * Get recent emails with optional query filter
     */
    getRecentEmails(options?: {
        max_results?: number;
        query?: string;
        time_filter?: string;
    }): Promise<EmailData[]>;
    /**
     * Parse Gmail message into readable format
     */
    private _parseEmail;
    /**
     * Extract email body from payload
     */
    private _extractBody;
    /**
     * Send an email
     */
    sendMessage(to: string, subject: string, body: string): Promise<gmail_v1.Schema$Message | null>;
}

/**
 * MCP Server for browser-use - exposes browser automation capabilities via Model Context Protocol.
 *
 * This server provides tools for:
 * - Running autonomous browser tasks with an AI agent
 * - Direct browser control (navigation, clicking, typing, etc.)
 * - Content extraction from web pages
 * - File system operations
 *
 * Usage:
 *     npx browser-use --mcp
 *
 * Or as an MCP server in Claude Desktop or other MCP clients:
 *     {
 *         "mcpServers": {
 *             "browser-use": {
 *                 "command": "npx",
 *                 "args": ["browser-use", "--mcp"],
 *                 "env": {
 *                     "OPENAI_API_KEY": "sk-proj-1234567890"
 *                 }
 *             }
 *         }
 *     }
 */
import { z } from 'zod';
import type { Controller } from '../controller/service.js';
import { BrowserSession } from '../browser/session.js';
export interface MCPPromptTemplate {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
    template: (args: Record<string, string>) => string;
}
export declare class MCPServer {
    private server;
    private tools;
    private prompts;
    private config;
    private browserSession;
    private controller;
    private llm;
    private fileSystem;
    private startTime;
    private isRunning;
    private toolExecutionCount;
    private errorCount;
    private abortController;
    private activeSessions;
    private sessionTimeoutMinutes;
    private sessionCleanupInterval;
    constructor(name: string, version: string);
    private resolvePath;
    private getDefaultProfileConfig;
    private getDefaultLlmConfig;
    private isPlaceholderOpenAiApiKey;
    private seedOpenAiApiKeyFromConfig;
    private createLlmFromModelName;
    private sanitizeProfileConfig;
    private buildDirectSessionProfile;
    private buildRetryProfile;
    private initializeLlmForDirectTools;
    private initializeFileSystem;
    private formatRetryResult;
    private trackSession;
    private updateSessionActivity;
    private serializeTrackedSessions;
    private shutdownSession;
    private closeSessionById;
    private closeAllTrackedSessions;
    private cleanupExpiredSessions;
    private startSessionCleanupLoop;
    private stopSessionCleanupLoop;
    private formatToolResult;
    private setupHandlers;
    private ensureController;
    private ensureBrowserSession;
    private executeControllerAction;
    private registerCoreBrowserTools;
    /**
     * Register default prompts for common browser automation tasks
     */
    private registerDefaultPrompts;
    /**
     * Register a tool with the MCP server
     */
    registerTool(name: string, description: string, inputSchema: z.ZodType | Record<string, any>, handler: (args: any) => Promise<any>): void;
    /**
     * Register all Controller actions as MCP tools
     */
    registerControllerActions(controller: Controller<any>): Promise<void>;
    /**
     * Initialize the browser session
     */
    initBrowserSession(browserSession: BrowserSession): Promise<void>;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Stop the MCP server and cleanup resources
     */
    stop(): Promise<void>;
    /**
     * Register a prompt template
     */
    registerPrompt(prompt: MCPPromptTemplate): void;
    /**
     * Get the number of registered tools
     */
    getToolCount(): number;
    /**
     * Get the number of registered prompts
     */
    getPromptCount(): number;
    /**
     * Get server health status
     */
    getHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        uptime: number;
        toolExecutionCount: number;
        errorCount: number;
        errorRate: number;
        browserSessionActive: boolean;
    };
    /**
     * Get server statistics
     */
    getStats(): {
        toolsRegistered: number;
        promptsRegistered: number;
        uptime: number;
        executionCount: number;
        errorCount: number;
        successRate: number;
    };
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Check if server is running
     */
    isServerRunning(): boolean;
}

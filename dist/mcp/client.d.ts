/**
 * MCP (Model Context Protocol) client integration for browser-use.
 *
 * This module provides integration between external MCP servers and browser-use's action registry.
 * MCP tools are dynamically discovered and registered as browser-use actions.
 *
 * Example usage:
 *     import { Tools } from './tools/service.js';
 *     import { MCPClient } from './mcp/client.js';
 *
 *     const tools = new Tools();
 *
 *     // Connect to an MCP server
 *     const mcpClient = new MCPClient(
 *         'my-server',
 *         'npx',
 *         ['@mycompany/mcp-server@latest']
 *     );
 *
 *     // Register all MCP tools as browser-use actions
 *     await mcpClient.registerToTools(tools);
 *
 *     // Now use with Agent as normal - MCP tools are available as actions
 */
import { type Tool, type Prompt } from '@modelcontextprotocol/sdk/types.js';
import type { Controller } from '../controller/service.js';
import type { Tools } from '../tools/service.js';
export interface MCPClientOptions {
    /** Maximum number of connection retry attempts (default: 3) */
    maxRetries?: number;
    /** Connection timeout in seconds (default: 30) */
    connectionTimeout?: number;
    /** Tool call timeout in seconds (default: 60) */
    toolCallTimeout?: number;
    /** Enable auto-reconnect on connection loss (default: true) */
    autoReconnect?: boolean;
    /** Health check interval in seconds (default: 30, 0 = disabled) */
    healthCheckInterval?: number;
}
export declare class MCPClient {
    private client;
    private command;
    private args;
    private env?;
    private serverName;
    private _tools;
    private _prompts;
    private _registeredActions;
    private _connected;
    private _connecting;
    private _toolCallCount;
    private _errorCount;
    private _lastConnectTime?;
    private _lastHealthCheck?;
    private _healthCheckInterval?;
    private maxRetries;
    private connectionTimeout;
    private toolCallTimeout;
    private autoReconnect;
    private healthCheckIntervalSeconds;
    constructor(serverName: string, command: string, args?: string[], env?: Record<string, string>, options?: MCPClientOptions);
    /**
     * Connect to the MCP server and discover available tools
     */
    connect(timeout?: number): Promise<void>;
    private _connectWithTimeout;
    /**
     * Disconnect from the MCP server
     */
    disconnect(): Promise<void>;
    /**
     * List all available tools from the MCP server
     */
    listTools(): Promise<Tool[]>;
    /**
     * Call a tool on the MCP server
     */
    callTool(name: string, args: any): Promise<any>;
    /**
     * Register MCP tools as actions in browser-use tools.
     *
     * @param tools - Browser-use tools to register actions to
     * @param toolFilter - Optional list of tool names to register (undefined = all tools)
     * @param prefix - Optional prefix to add to action names (e.g., "playwright_")
     */
    registerToTools(tools: Pick<Tools, 'registry'>, toolFilter?: string[], prefix?: string): Promise<void>;
    /**
     * @deprecated Use `registerToTools` instead.
     */
    registerToController(controller: Controller<any>, toolFilter?: string[], prefix?: string): Promise<void>;
    private _registerToolAsAction;
    private _convertToolSchemaToParamModel;
    private _jsonSchemaToZod;
    private _toJsonSchemaObject;
    private _toLiteralUnion;
    private _isLiteralPrimitive;
    private _applyDefault;
    private _applySchemaMetadata;
    private _formatMcpResult;
    /**
     * List available prompts from the MCP server
     */
    listPrompts(): Promise<Prompt[]>;
    /**
     * Get a prompt with arguments
     */
    getPrompt(name: string, args?: Record<string, string>): Promise<any>;
    /**
     * Start health check monitoring
     */
    private _startHealthCheck;
    /**
     * Stop health check monitoring
     */
    private _stopHealthCheck;
    /**
     * Perform health check by listing tools
     */
    private _performHealthCheck;
    /**
     * Attempt to reconnect to the server
     */
    private _attemptReconnect;
    /**
     * Get client statistics
     */
    getStats(): {
        serverName: string;
        connected: boolean;
        toolsDiscovered: number;
        promptsDiscovered: number;
        toolCallCount: number;
        errorCount: number;
        successRate: number;
        uptime?: number;
        lastHealthCheck?: number;
    };
    /**
     * Check if client is connected
     */
    isConnected(): boolean;
    /**
     * Reset statistics
     */
    resetStats(): void;
    [Symbol.asyncDispose](): Promise<void>;
}

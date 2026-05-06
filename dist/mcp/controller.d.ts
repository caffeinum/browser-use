import type { Registry } from '../tools/registry/service.js';
import type { Tools } from '../tools/service.js';
import { MCPClient, type MCPClientOptions } from './client.js';
export interface MCPToolWrapperOptions {
    serverName?: string;
    env?: Record<string, string>;
    clientOptions?: MCPClientOptions;
}
export declare class MCPToolWrapper {
    private registry;
    private client;
    constructor(registry: Registry, mcpCommand: string, mcpArgs?: string[], options?: MCPToolWrapperOptions);
    connect(toolFilter?: string[], prefix?: string, tools?: Pick<Tools, 'registry'>): Promise<void>;
    disconnect(): Promise<void>;
    getClient(): MCPClient;
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
}
export declare function registerMcpTools(registry: Registry, mcpCommand: string, mcpArgs?: string[], options?: MCPToolWrapperOptions): Promise<MCPToolWrapper>;
export interface AddMCPServerOptions {
    serverName?: string;
    env?: Record<string, string>;
    clientOptions?: MCPClientOptions;
    toolFilter?: string[];
    prefix?: string;
    tools?: Pick<Tools, 'registry'>;
}
export declare class MCPController {
    private clients;
    private tools;
    constructor(tools?: Pick<Tools, 'registry'> | null);
    setTools(tools: Pick<Tools, 'registry'>): void;
    addServer(command: string, args?: string[], options?: AddMCPServerOptions): Promise<MCPClient>;
    getClients(): MCPClient[];
    disconnectAll(): Promise<void>;
}

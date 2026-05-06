import { createLogger } from '../logging-config.js';
import { MCPClient } from './client.js';
const logger = createLogger('browser_use.mcp.controller');
export class MCPToolWrapper {
    registry;
    client;
    constructor(registry, mcpCommand, mcpArgs = [], options = {}) {
        this.registry = registry;
        this.client = new MCPClient(options.serverName ?? 'browser-use-mcp-tools', mcpCommand, mcpArgs, options.env, options.clientOptions);
    }
    async connect(toolFilter, prefix, tools) {
        if (!this.client.isConnected()) {
            await this.client.connect();
        }
        const targetTools = tools ?? { registry: this.registry };
        await this.client.registerToTools(targetTools, toolFilter, prefix);
    }
    async disconnect() {
        await this.client.disconnect();
    }
    getClient() {
        return this.client;
    }
    getStats() {
        return this.client.getStats();
    }
}
export async function registerMcpTools(registry, mcpCommand, mcpArgs = [], options = {}) {
    const wrapper = new MCPToolWrapper(registry, mcpCommand, mcpArgs, options);
    await wrapper.connect();
    return wrapper;
}
// Backward-compatible helper that can manage multiple MCP clients.
export class MCPController {
    clients = [];
    tools;
    constructor(tools = null) {
        this.tools = tools;
    }
    setTools(tools) {
        this.tools = tools;
    }
    async addServer(command, args = [], options = {}) {
        const client = new MCPClient(options.serverName ?? `browser-use-client-${this.clients.length + 1}`, command, args, options.env, options.clientOptions);
        await client.connect();
        const targetTools = options.tools ?? this.tools;
        if (targetTools) {
            await client.registerToTools(targetTools, options.toolFilter, options.prefix);
        }
        else {
            logger.warning('MCPController.addServer connected but skipped tool registration because no Tools instance was provided');
        }
        this.clients.push(client);
        return client;
    }
    getClients() {
        return [...this.clients];
    }
    async disconnectAll() {
        await Promise.all(this.clients.map((client) => client.disconnect()));
        this.clients = [];
    }
}

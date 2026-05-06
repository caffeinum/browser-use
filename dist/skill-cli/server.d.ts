import { Request, Response } from './protocol.js';
import { SessionRegistry } from './sessions.js';
export interface SkillCliServerOptions {
    registry?: SessionRegistry;
}
export declare class SkillCliServer {
    readonly registry: SessionRegistry;
    constructor(options?: SkillCliServerOptions);
    private _require_node_by_index;
    private _read_node_data;
    private _handle_browser_action;
    handle_request(request: Request | string): Promise<Response>;
}

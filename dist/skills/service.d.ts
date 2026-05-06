import { build_skill_parameters_schema } from './utils.js';
import { type BrowserCookie, type ExecuteSkillInput, type SkillDefinition, type SkillExecutionResult, type SkillService } from './views.js';
interface CloudSkillServiceOptions {
    skill_ids: Array<string | '*'>;
    api_key?: string | null;
    base_url?: string | null;
    fetch_impl?: typeof fetch;
}
export declare class CloudSkillService implements SkillService {
    private readonly skill_ids;
    private readonly api_key;
    private readonly base_url;
    private readonly fetch_impl;
    private initialized;
    private readonly skills;
    constructor(options: CloudSkillServiceOptions);
    private requestJson;
    private listSkillsPage;
    private ensureInitialized;
    get_skill(skill_id: string): Promise<SkillDefinition | null>;
    get_all_skills(): Promise<SkillDefinition[]>;
    execute_skill(input: ExecuteSkillInput): Promise<SkillExecutionResult>;
    close(): Promise<void>;
}
export declare const register_skills_as_actions: (skills: SkillDefinition[], registerAction: (slug: string, description: string, params: ReturnType<typeof build_skill_parameters_schema>, skill: SkillDefinition) => void) => Promise<void>;
export declare const cookies_to_map: (cookies: BrowserCookie[]) => Map<string, string>;
export {};

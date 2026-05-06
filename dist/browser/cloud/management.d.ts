export interface CloudManagementClientOptions {
    api_base_url?: string;
    api_key?: string | null;
    fetch_impl?: typeof fetch;
}
export interface CloudTaskView {
    id: string;
    sessionId: string;
    llm?: string | null;
    task: string;
    status: string;
    createdAt: string;
    startedAt?: string | null;
    finishedAt?: string | null;
    metadata?: Record<string, unknown> | null;
    output?: string | null;
    browserUseVersion?: string | null;
    isSuccess?: boolean | null;
    judgement?: string | null;
    judgeVerdict?: boolean | null;
    steps?: Array<Record<string, unknown>>;
    outputFiles?: Array<Record<string, unknown>>;
}
export interface CloudSessionView {
    id: string;
    status: string;
    startedAt: string;
    liveUrl?: string | null;
    finishedAt?: string | null;
    tasks?: CloudTaskView[];
    publicShareUrl?: string | null;
}
export interface CloudProfileView {
    id: string;
    createdAt: string;
    updatedAt: string;
    name?: string | null;
    lastUsedAt?: string | null;
    cookieDomains?: string[] | null;
}
export interface CloudShareView {
    shareToken: string;
    shareUrl: string;
    viewCount: number;
    lastViewedAt?: string | null;
}
export interface PaginatedResponse<T> {
    items: T[];
    totalItems: number;
    pageNumber: number;
    pageSize: number;
}
export interface CreateTaskRequest {
    task: string;
    llm?: string | null;
    startUrl?: string | null;
    maxSteps?: number | null;
    structuredOutput?: string | null;
    sessionId?: string | null;
    metadata?: Record<string, string> | null;
    secrets?: Record<string, string> | null;
    allowedDomains?: string[] | null;
    opVaultId?: string | null;
    highlightElements?: boolean;
    flashMode?: boolean;
    thinking?: boolean;
    vision?: boolean | 'auto' | null;
    systemPromptExtension?: string | null;
    judge?: boolean;
    judgeGroundTruth?: string | null;
    judgeLlm?: string | null;
    skillIds?: string[] | null;
}
export interface CreateSessionRequest {
    profileId?: string | null;
    proxyCountryCode?: string | null;
    startUrl?: string | null;
    browserScreenWidth?: number | null;
    browserScreenHeight?: number | null;
}
export declare class CloudManagementClient {
    private readonly api_base_url;
    private readonly explicit_api_key;
    private readonly fetch_impl;
    constructor(options?: CloudManagementClientOptions);
    private resolve_api_key;
    private auth_headers;
    private request_json;
    private build_query;
    list_tasks(options?: {
        pageSize?: number;
        pageNumber?: number;
        sessionId?: string | null;
        filterBy?: string | null;
        after?: string | null;
        before?: string | null;
    }): Promise<PaginatedResponse<CloudTaskView>>;
    create_task(request: CreateTaskRequest): Promise<{
        id: string;
        sessionId: string;
    }>;
    get_task(task_id: string): Promise<CloudTaskView>;
    update_task(task_id: string, action: 'stop' | 'stop_task_and_session'): Promise<CloudTaskView>;
    get_task_logs(task_id: string): Promise<{
        downloadUrl: string;
    }>;
    list_sessions(options?: {
        pageSize?: number;
        pageNumber?: number;
        filterBy?: string | null;
    }): Promise<PaginatedResponse<CloudSessionView>>;
    create_session(request: CreateSessionRequest): Promise<CloudSessionView>;
    get_session(session_id: string): Promise<CloudSessionView>;
    update_session(session_id: string, action: 'stop'): Promise<CloudSessionView>;
    delete_session(session_id: string): Promise<void>;
    create_session_public_share(session_id: string): Promise<CloudShareView>;
    delete_session_public_share(session_id: string): Promise<void>;
    list_profiles(options?: {
        pageSize?: number;
        pageNumber?: number;
    }): Promise<PaginatedResponse<CloudProfileView>>;
    create_profile(request?: {
        name?: string | null;
    }): Promise<CloudProfileView>;
    get_profile(profile_id: string): Promise<CloudProfileView>;
    update_profile(profile_id: string, request?: {
        name?: string | null;
    }): Promise<CloudProfileView>;
    delete_profile(profile_id: string): Promise<void>;
}

import { type AxiosInstance } from 'axios';
export declare const TEMP_USER_ID = "99999999-9999-9999-9999-999999999999";
interface CloudAuthConfigData {
    api_token: string | null;
    user_id: string | null;
    authorized_at: string | null;
}
export declare const load_cloud_auth_config: () => CloudAuthConfigData;
export declare const save_cloud_api_token: (api_token: string, user_id?: string | null) => void;
export declare class DeviceAuthClient {
    private readonly baseUrl;
    private readonly clientId;
    private readonly scope;
    private readonly httpClient?;
    private authConfig;
    private _deviceId;
    constructor(baseUrl?: string, httpClient?: AxiosInstance);
    get device_id(): string;
    get is_authenticated(): boolean;
    get api_token(): string | null;
    get user_id(): string;
    private get client();
    private buildUrl;
    private postForm;
    start_device_authorization(agent_session_id?: string | null): Promise<Record<string, any>>;
    poll_for_token(device_code: string, interval?: number, timeout?: number): Promise<Record<string, any> | null>;
    authenticate(agent_session_id?: string | null, show_instructions?: boolean): Promise<boolean>;
    get_headers(): {
        Authorization: string;
    } | {
        Authorization?: undefined;
    };
    clear_auth(): void;
}
export {};

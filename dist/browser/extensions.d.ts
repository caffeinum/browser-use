/**
 * Browser Extension Management
 * Handles Chrome extension download, installation, and runtime integration.
 * Supports both Manifest V2 and V3 extensions.
 */
export interface BrowserExtensionDescriptor {
    name: string;
    webstore_id?: string;
    id?: string;
    webstore_url?: string;
    crx_url?: string;
    crx_path?: string;
    unpacked_path?: string;
    version?: string;
    manifest?: any;
    manifest_version?: string;
    homepage_url?: string;
    options_url?: string;
    target?: any;
    target_ctx?: any;
    target_type?: string;
    target_url?: string;
    read_manifest?: () => any;
    read_version?: () => string | null;
    dispatch_eval?: (...args: any[]) => Promise<any>;
    dispatch_popup?: () => Promise<any>;
    dispatch_action?: (tab?: any) => Promise<any>;
    dispatch_message?: (message: any, options?: any) => Promise<any>;
    dispatch_command?: (command: string, tab?: any) => Promise<any>;
}
/**
 * Generate extension ID from unpacked path
 * Chrome uses SHA256 hash of the directory path
 */
export declare function getExtensionId(unpackedPath: string): string | null;
/**
 * Load or install extension
 */
export declare function loadOrInstallExtension(ext: BrowserExtensionDescriptor, extensionsDir?: string): Promise<BrowserExtensionDescriptor>;
/**
 * Check if a browser target is an extension
 */
export declare function isTargetExtension(target: any): Promise<{
    target_type: string | null;
    target_ctx: any;
    target_url: string | null;
    target_is_bg: boolean;
    target_is_extension: boolean;
    extension_id: string | null;
    manifest_version: string;
}>;
/**
 * Load extension from browser target (runtime connection)
 */
export declare function loadExtensionFromTarget(extensions: BrowserExtensionDescriptor[], target: any): Promise<BrowserExtensionDescriptor | null>;
/**
 * Load all Chrome extensions from browser targets
 */
export declare function getChromeExtensionsFromBrowser(browser: any, extensions: BrowserExtensionDescriptor[]): Promise<BrowserExtensionDescriptor[]>;
/**
 * Install extensions from persona configuration
 */
export declare function installExtensionsFromConfig(extensionConfigs: BrowserExtensionDescriptor[], extensionsDir: string): Promise<BrowserExtensionDescriptor[]>;

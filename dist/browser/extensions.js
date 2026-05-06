/**
 * Browser Extension Management
 * Handles Chrome extension download, installation, and runtime integration.
 * Supports both Manifest V2 and V3 extensions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
// @ts-ignore - extract-zip types may not be available
import extract from 'extract-zip';
import { createLogger } from '../logging-config.js';
const logger = createLogger('browser_use.extensions');
/**
 * Generate extension ID from unpacked path
 * Chrome uses SHA256 hash of the directory path
 */
export function getExtensionId(unpackedPath) {
    const manifestPath = path.join(unpackedPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        return null;
    }
    // Chrome uses SHA256 hash and converts to letter format
    const hash = createHash('sha256').update(unpackedPath).digest('hex');
    const extensionId = hash
        .slice(0, 32)
        .split('')
        .map((char) => String.fromCharCode(parseInt(char, 16) + 'a'.charCodeAt(0)))
        .join('');
    return extensionId;
}
/**
 * Download CRX file from Chrome Web Store
 */
async function downloadCrx(crxUrl, crxPath) {
    try {
        logger.info(`[🛠️] Downloading extension from ${crxUrl}...`);
        const response = await fetch(crxUrl);
        if (!response.ok || !response.body) {
            logger.warning(`[⚠️] Failed to download extension: ${response.statusText}`);
            return false;
        }
        // Ensure directory exists
        const dir = path.dirname(crxPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Download file
        const fileStream = createWriteStream(crxPath);
        await pipeline(Readable.fromWeb(response.body), fileStream);
        logger.info(`[✅] Downloaded to ${crxPath}`);
        return true;
    }
    catch (error) {
        logger.error(`[❌] Download failed: ${error.message}`);
        return false;
    }
}
/**
 * Extract CRX file to unpacked directory
 */
async function unpackCrx(crxPath, unpackedPath) {
    try {
        // Ensure unpacked directory exists
        if (!fs.existsSync(unpackedPath)) {
            fs.mkdirSync(unpackedPath, { recursive: true });
        }
        // Extract zip file (CRX is essentially a ZIP with extra header)
        await extract(crxPath, { dir: path.resolve(unpackedPath) });
        // Verify manifest exists
        const manifestPath = path.join(unpackedPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            logger.error(`[❌] No manifest.json found in ${unpackedPath}`);
            return false;
        }
        logger.info(`[✅] Extracted to ${unpackedPath}`);
        return true;
    }
    catch (error) {
        logger.error(`[❌] Extraction failed: ${error.message}`);
        return false;
    }
}
/**
 * Install extension (download and unpack if needed)
 */
async function installExtension(extension) {
    const manifestPath = path.join(extension.unpacked_path, 'manifest.json');
    const crxPath = extension.crx_path;
    // Download CRX if neither manifest nor CRX exists
    if (!fs.existsSync(manifestPath) && !fs.existsSync(crxPath)) {
        logger.info(`[🛠️] Downloading missing extension ${extension.name} ${extension.webstore_id} -> ${crxPath}`);
        const downloaded = await downloadCrx(extension.crx_url, crxPath);
        if (!downloaded) {
            return false;
        }
    }
    // Unpack CRX if manifest doesn't exist
    if (!fs.existsSync(manifestPath)) {
        const unpacked = await unpackCrx(crxPath, extension.unpacked_path);
        if (!unpacked) {
            return false;
        }
    }
    return true;
}
/**
 * Load or install extension
 */
export async function loadOrInstallExtension(ext, extensionsDir = path.join(process.cwd(), '.browser-use', 'extensions')) {
    if (!ext.webstore_id && !ext.unpacked_path) {
        throw new Error('Extension must have either webstore_id or unpacked_path');
    }
    // Set statically computable extension metadata
    ext.webstore_id = ext.webstore_id || ext.id;
    ext.name = ext.name || ext.webstore_id;
    ext.webstore_url =
        ext.webstore_url ||
            `https://chromewebstore.google.com/detail/${ext.webstore_id}`;
    ext.crx_url =
        ext.crx_url ||
            `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx3&x=id%3D${ext.webstore_id}%26uc`;
    ext.crx_path =
        ext.crx_path ||
            path.join(extensionsDir, `${ext.webstore_id}__${ext.name}.crx`);
    ext.unpacked_path =
        ext.unpacked_path ||
            path.join(extensionsDir, `${ext.webstore_id}__${ext.name}`);
    const manifestPath = path.join(ext.unpacked_path, 'manifest.json');
    // Helper functions
    const readManifest = () => {
        if (fs.existsSync(manifestPath)) {
            return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        }
        return null;
    };
    const readVersion = () => {
        const manifest = readManifest();
        return manifest?.version || null;
    };
    ext.read_manifest = readManifest;
    ext.read_version = readVersion;
    // Install extension if not already installed
    if (!readVersion()) {
        await installExtension(ext);
    }
    // Auto-detect ID and version
    ext.id = getExtensionId(ext.unpacked_path) ?? undefined;
    ext.version = readVersion() ?? undefined;
    if (!ext.version) {
        logger.warning(`[❌] Unable to detect ID and version of installed extension ${ext.unpacked_path}`);
    }
    else {
        logger.info(`[➕] Installed extension ${ext.name} (${ext.version})... ${ext.unpacked_path}`);
    }
    return ext;
}
/**
 * Check if a browser target is an extension
 */
export async function isTargetExtension(target) {
    const targetInfo = await (async () => {
        try {
            const target_type = await target.type();
            const target_ctx = (await target.worker?.()) || (await target.page?.()) || null;
            const target_url = (await target.url?.()) || (target_ctx ? await target_ctx.url() : null);
            return { target_type, target_ctx, target_url };
        }
        catch (error) {
            if (error.message?.includes('No target with given id found')) {
                // Target already closed
                return {
                    target_type: 'closed',
                    target_ctx: null,
                    target_url: 'about:closed',
                };
            }
            throw error;
        }
    })();
    const { target_type, target_ctx, target_url } = targetInfo;
    const target_is_bg = ['service_worker', 'background_page'].includes(target_type || '');
    const target_is_extension = target_url?.startsWith('chrome-extension://') || false;
    const extension_id = target_is_extension
        ? target_url.split('://')[1].split('/')[0]
        : null;
    const manifest_version = target_type === 'service_worker' ? '3' : '2';
    return {
        target_type,
        target_ctx,
        target_url,
        target_is_bg,
        target_is_extension,
        extension_id,
        manifest_version,
    };
}
/**
 * Load extension from browser target (runtime connection)
 */
export async function loadExtensionFromTarget(extensions, target) {
    const extensionInfo = await isTargetExtension(target);
    const { target_is_bg, target_is_extension, target_type, target_ctx, target_url, extension_id, manifest_version, } = extensionInfo;
    if (!target_is_bg || !extension_id || !target_ctx) {
        return null;
    }
    // Get manifest from extension
    const manifest = await target_ctx.evaluate('() => chrome.runtime.getManifest()');
    const name = manifest.name;
    const version = manifest.version;
    const homepage_url = manifest.homepage_url;
    const options_page = manifest.options_page;
    const options_ui = manifest.options_ui || {};
    if (!version || !extension_id) {
        return null;
    }
    // Get options URL
    const options_url = await target_ctx.evaluate('(options_page) => chrome.runtime.getURL(options_page)', options_page || options_ui.page || 'options.html');
    // Get keyboard commands
    const commands = await target_ctx.evaluate(`
		async () => {
			return await new Promise((resolve) => {
				if (chrome.commands) {
					chrome.commands.getAll(resolve);
				} else {
					resolve({});
				}
			});
		}
	`);
    // Dispatch helpers
    const dispatch_eval = async (...args) => {
        return await target_ctx.evaluate(...args);
    };
    const dispatch_popup = async () => {
        return await target_ctx.evaluate("() => chrome.action?.openPopup() || chrome.tabs.create({url: chrome.runtime.getURL('popup.html')})");
    };
    let dispatch_action;
    let dispatch_message;
    let dispatch_command;
    if (manifest_version === '3') {
        // Manifest V3 APIs
        dispatch_action = async (tab) => {
            return await target_ctx.evaluate(`
				async (tab) => {
					tab = tab || (await new Promise((resolve) =>
						chrome.tabs.query({currentWindow: true, active: true}, ([tab]) => resolve(tab))
					));
					return await chrome.action.onClicked.dispatch(tab);
				}
			`, tab);
        };
        dispatch_message = async (message, options) => {
            return await target_ctx.evaluate(`
				async (extension_id, message, options) => {
					return await chrome.runtime.sendMessage(extension_id, message, options);
				}
			`, extension_id, message, options);
        };
        dispatch_command = async (command, tab) => {
            return await target_ctx.evaluate(`
				async (command, tab) => {
					return await chrome.commands.onCommand.dispatch(command, tab);
				}
			`, command, tab);
        };
    }
    else {
        // Manifest V2 APIs
        dispatch_action = async (tab) => {
            return await target_ctx.evaluate(`
				async (tab) => {
					tab = tab || (await new Promise((resolve) =>
						chrome.tabs.query({currentWindow: true, active: true}, ([tab]) => resolve(tab))
					));
					return await chrome.browserAction.onClicked.dispatch(tab);
				}
			`, tab);
        };
        dispatch_message = async (message, options) => {
            return await target_ctx.evaluate(`
				async (extension_id, message, options) => {
					return await new Promise((resolve) =>
						chrome.runtime.sendMessage(extension_id, message, options, resolve)
					);
				}
			`, extension_id, message, options);
        };
        dispatch_command = async (command, tab) => {
            return await target_ctx.evaluate(`
				async (command, tab) => {
					return await new Promise((resolve) =>
						chrome.commands.onCommand.dispatch(command, tab, resolve)
					);
				}
			`, command, tab);
        };
    }
    // Find existing extension or create new one
    const existing_extension = extensions.find((ext) => ext.id === extension_id) ||
        {};
    const new_extension = {
        ...existing_extension,
        id: extension_id,
        name,
        target,
        target_ctx,
        target_type: target_type,
        target_url: target_url,
        manifest_version,
        manifest,
        version,
        homepage_url,
        options_url,
        dispatch_eval,
        dispatch_popup,
        dispatch_action,
        dispatch_message,
        dispatch_command,
    };
    logger.info(`[➕] Loaded extension ${name.slice(0, 32)} (${version}) ${target_type}... ${target_url}`);
    // Update existing extension in-place
    Object.assign(existing_extension, new_extension);
    return new_extension;
}
/**
 * Load all Chrome extensions from browser targets
 */
export async function getChromeExtensionsFromBrowser(browser, extensions) {
    logger.info(`[⚙️] Loading ${extensions.length} chrome extensions from browser...`);
    // Find loaded extensions at runtime by checking all browser targets
    const targets = await browser.targets();
    for (const target of targets) {
        await loadExtensionFromTarget(extensions, target);
    }
    return extensions;
}
/**
 * Install extensions from persona configuration
 */
export async function installExtensionsFromConfig(extensionConfigs, extensionsDir) {
    logger.info('*************************************************************************');
    logger.info(`[⚙️] Installing ${extensionConfigs.length} chrome extensions...`);
    const extensions = [];
    try {
        // Install each extension
        for (const config of extensionConfigs) {
            const extension = await loadOrInstallExtension(config, extensionsDir);
            extensions.push(extension);
        }
    }
    catch (error) {
        logger.error(`[❌] Extension installation failed: ${error.message}`);
    }
    logger.info('*************************************************************************');
    return extensions;
}

import type { Browser as PlaywrightBrowser, BrowserContextOptions, BrowserContext as PlaywrightBrowserContext, ElementHandle as PlaywrightElementHandle, FrameLocator as PlaywrightFrameLocator, LaunchOptions, Page as PlaywrightPage, Locator as PlaywrightLocator } from 'playwright';
export type Browser = PlaywrightBrowser;
export type BrowserContext = PlaywrightBrowserContext;
export type Page = PlaywrightPage;
export type ElementHandle<T = unknown> = PlaywrightElementHandle<T>;
export type FrameLocator = PlaywrightFrameLocator;
export type Locator = PlaywrightLocator;
export type PlaywrightModule = typeof import('playwright');
export type Playwright = PlaywrightModule;
export type PlaywrightOrPatchright = PlaywrightModule;
export declare const async_playwright: () => Promise<{
    default: typeof import("playwright");
    errors: typeof import("playwright").errors;
    devices: {
        [key: string]: {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Blackberry PlayBook": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Blackberry PlayBook landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "BlackBerry Z30": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "BlackBerry Z30 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Note 3": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Note 3 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Note II": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Note II landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S III": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S III landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S5": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S5 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S8": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S8 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S9+": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S9+ landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S24": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy S24 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy A55": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy A55 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Tab S4": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Tab S4 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Tab S9": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Galaxy Tab S9 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 5)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 5) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 6)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 6) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 7)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 7) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 11)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad (gen 11) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad Mini": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad Mini landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad Pro 11": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPad Pro 11 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 6": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 6 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 6 Plus": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 6 Plus landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 7": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 7 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 7 Plus": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 7 Plus landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 8": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 8 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 8 Plus": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 8 Plus landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone SE": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone SE landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone SE (3rd gen)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone SE (3rd gen) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone X": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone X landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone XR": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone XR landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11 Pro": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11 Pro landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11 Pro Max": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 11 Pro Max landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Pro": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Pro landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Pro Max": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Pro Max landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Mini": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 12 Mini landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Pro": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Pro landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Pro Max": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Pro Max landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Mini": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 13 Mini landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Plus": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Plus landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Pro": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Pro landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Pro Max": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 14 Pro Max landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Plus": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Plus landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Pro": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Pro landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Pro Max": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "iPhone 15 Pro Max landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Kindle Fire HDX": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Kindle Fire HDX landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "LG Optimus L70": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "LG Optimus L70 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Microsoft Lumia 550": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Microsoft Lumia 550 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Microsoft Lumia 950": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Microsoft Lumia 950 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 10": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 10 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 4": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 4 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 5": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 5 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 5X": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 5X landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 6": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 6 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 6P": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 6P landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 7": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nexus 7 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nokia Lumia 520": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nokia Lumia 520 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nokia N9": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Nokia N9 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 2": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 2 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 2 XL": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 2 XL landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 3": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 3 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 4": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 4 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 4a (5G)": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 4a (5G) landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 5": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 5 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 7": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Pixel 7 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Moto G4": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Moto G4 landscape": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Chrome HiDPI": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Edge HiDPI": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Firefox HiDPI": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Safari": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Chrome": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Edge": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        "Desktop Firefox": {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
    };
    _electron: import("playwright").Electron;
    _android: import("playwright").Android;
    chromium: import("playwright").BrowserType;
    firefox: import("playwright").BrowserType;
    request: import("playwright").APIRequest;
    selectors: import("playwright").Selectors;
    webkit: import("playwright").BrowserType;
}>;
export type ProxySettings = NonNullable<LaunchOptions['proxy']>;
export type HttpCredentials = NonNullable<BrowserContextOptions['httpCredentials']>;
export type Geolocation = NonNullable<BrowserContextOptions['geolocation']>;
export type ViewportSize = NonNullable<BrowserContextOptions['viewport']>;
export type StorageState = Exclude<BrowserContextOptions['storageState'], undefined>;
export type ClientCertificate = NonNullable<NonNullable<BrowserContextOptions['clientCertificates']>[number]>;

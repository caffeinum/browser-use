/**
 * Interactive DOM element testing tool.
 *
 * This playground allows you to:
 * - Navigate to websites
 * - Extract DOM state and clickable elements
 * - Interactively click elements by index
 * - Input text into elements
 * - Copy element JSON to clipboard
 * - Analyze token counts for LLM prompts
 *
 * Usage:
 * - Enter an element index to click it
 * - Enter 'index,text' to input text into an element
 * - Enter 'c,index' to copy element JSON to clipboard
 * - Enter 'q' to quit
 */
declare function testFocusVsAllElements(): Promise<void>;
export { testFocusVsAllElements };

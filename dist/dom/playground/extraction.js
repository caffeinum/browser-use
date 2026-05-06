import * as fs from 'fs/promises';
import * as readline from 'readline';
import { promisify } from 'util';
import { BrowserProfile, BrowserSession } from '../../browser/index.js';
import { DomService } from '../service.js';
import { DEFAULT_INCLUDE_ATTRIBUTES } from '../views.js';
import { AgentMessagePrompt } from '../../agent/prompts.js';
import { FileSystem } from '../../filesystem/file-system.js';
const TIMEOUT = 60;
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
async function testFocusVsAllElements() {
    const browserSession = new BrowserSession({
        browser_profile: new BrowserProfile({
            window_size: { width: 1100, height: 1000 },
            disable_security: true,
            wait_for_network_idle_page_load_time: 1,
            headless: false,
        }),
    });
    const websites = [
        'https://google.com',
        'https://www.ycombinator.com/companies',
        'https://kayak.com/flights',
        'https://docs.google.com/spreadsheets/d/1INaIcfpYXlMRWO__de61SHFCaqt1lfHlcvtXZPItlpI/edit',
        'https://www.zeiss.com/career/en/job-search.html?page=1',
        'https://www.mlb.com/yankees/stats/',
        'https://www.amazon.com/s?k=laptop&s=review-rank',
        'https://reddit.com',
        'https://codepen.io/geheimschriftstift/pen/mPLvQz',
        'https://www.google.com/search?q=google+hi',
        'https://amazon.com',
        'https://github.com',
    ];
    await browserSession.start();
    const page = await browserSession.getCurrentPage();
    if (!page) {
        throw new Error('No page available');
    }
    const domService = new DomService(page);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const question = promisify(rl.question).bind(rl);
    for (const website of websites) {
        await page.goto(website);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        let lastClickedIndex = null;
        while (true) {
            try {
                console.log(`\n${'='.repeat(50)}\nTesting ${website}\n${'='.repeat(50)}`);
                console.log('\nGetting page state...');
                const startTime = Date.now();
                const allElementsState = await browserSession.get_state_summary(true);
                const endTime = Date.now();
                console.log(`get_state_summary took ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
                const selectorMap = allElementsState.selector_map;
                const totalElements = Object.keys(selectorMap).length;
                console.log(`Total number of elements: ${totalElements}`);
                const prompt = new AgentMessagePrompt({
                    browser_state_summary: allElementsState,
                    file_system: new FileSystem('./tmp'),
                    include_attributes: DEFAULT_INCLUDE_ATTRIBUTES,
                    step_info: null,
                });
                const userMessage = prompt.get_user_message(false).text || '';
                const textToSave = userMessage;
                await fs.mkdir('./tmp', { recursive: true });
                await fs.writeFile('./tmp/user_message.txt', textToSave, 'utf-8');
                await fs.writeFile('./tmp/element_tree.json', JSON.stringify(allElementsState.element_tree.toJSON(), null, 0), 'utf-8');
                try {
                    // Optional: tiktoken is not installed by default
                    // @ts-ignore - tiktoken is an optional dependency
                    const { encoding_for_model } = await import('tiktoken');
                    const encoding = encoding_for_model('gpt-4o');
                    const tokenCount = encoding.encode(textToSave).length;
                    console.log(`Token count: ${tokenCount}`);
                }
                catch (error) {
                    console.log('Could not calculate token count (tiktoken not installed):', error.message);
                }
                console.log('User message written to ./tmp/user_message.txt');
                console.log('Element tree written to ./tmp/element_tree.json');
                const answer = String(await question("Enter element index to click, 'index,text' to input, 'c,index' to copy element JSON, or 'q' to quit: "));
                if (answer.toLowerCase().trim() === 'q') {
                    break;
                }
                try {
                    if (answer.toLowerCase().startsWith('c,')) {
                        const parts = answer.split(',', 2);
                        if (parts.length === 2) {
                            try {
                                const targetIndex = parseInt(parts[1].trim(), 10);
                                if (targetIndex in selectorMap) {
                                    const elementNode = selectorMap[targetIndex];
                                    const elementJson = JSON.stringify(elementNode.toJSON(), null, 2);
                                    console.log(`Element ${targetIndex} JSON:`);
                                    console.log(elementJson);
                                    console.log(`\nElement: ${elementNode.tag_name}`);
                                }
                                else {
                                    console.log(`Invalid index: ${targetIndex}`);
                                }
                            }
                            catch {
                                console.log(`Invalid index format: ${parts[1]}`);
                            }
                        }
                        else {
                            console.log("Invalid input format. Use 'c,index'.");
                        }
                    }
                    else if (answer.includes(',')) {
                        const parts = answer.split(',', 2);
                        if (parts.length === 2) {
                            try {
                                const targetIndex = parseInt(parts[0].trim(), 10);
                                const textToInput = parts[1];
                                if (targetIndex in selectorMap) {
                                    const elementNode = selectorMap[targetIndex];
                                    console.log(`Inputting text '${textToInput}' into element ${targetIndex}: ${elementNode.tag_name}`);
                                    await browserSession._inputTextElementNode(elementNode, textToInput);
                                    console.log('Input successful.');
                                }
                                else {
                                    console.log(`Invalid index: ${targetIndex}`);
                                }
                            }
                            catch {
                                console.log(`Invalid index format: ${parts[0]}`);
                            }
                        }
                        else {
                            console.log("Invalid input format. Use 'index,text'.");
                        }
                    }
                    else {
                        try {
                            const clickedIndex = parseInt(answer, 10);
                            if (clickedIndex in selectorMap) {
                                const elementNode = selectorMap[clickedIndex];
                                console.log(`Clicking element ${clickedIndex}: ${elementNode.tag_name}`);
                                await browserSession._clickElementNode(elementNode);
                                console.log('Click successful.');
                            }
                            else {
                                console.log(`Invalid index: ${clickedIndex}`);
                            }
                        }
                        catch {
                            console.log(`Invalid input: '${answer}'. Enter an index, 'index,text', 'c,index', or 'q'.`);
                        }
                    }
                }
                catch (actionError) {
                    console.log(`Action failed: ${actionError.message}`);
                }
            }
            catch (error) {
                console.log(`Error in loop: ${error.message}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }
    rl.close();
    await browserSession.close();
}
if (require.main === module) {
    testFocusVsAllElements().catch(console.error);
}
export { testFocusVsAllElements };

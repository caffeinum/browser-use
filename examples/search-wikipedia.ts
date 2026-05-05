/**
 * Example demonstrating browser-use Agent for Wikipedia research
 *
 * This example uses the browser-use Agent to autonomously navigate Wikipedia
 * and extract information about Test-Driven Development.
 *
 * LLM Configuration (in order of preference):
 * 1. Azure OpenAI - Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT
 * 2. OpenAI - Set OPENAI_API_KEY
 * 3. Anthropic - Set ANTHROPIC_API_KEY
 * 4. Google Gemini - Set GOOGLE_API_KEY
 */

import 'dotenv/config';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { Agent, BrowserSession } from '../src/index.js';
import { Controller } from '../src/controller/service.js';
import type { BaseChatModel } from '../src/llm/base.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VIEWPORT = { width: 1440, height: 900 };

// Azure OpenAI Configuration
const AZURE_CONFIG = {
  endpoint: 'https://oai-ai4m-rnd-eastus-001.openai.azure.com',
  deployment: 'oai-ai4m-rnd-eastus-001-gpt-4-0125-Preview-001',
  apiVersion: '2025-03-01-preview',
};

/**
 * Create a timestamped log directory for storing screenshots and conversations
 */
function createLogDirectory(): string {
  const timestamp = new Date().toISOString();
  const logDir = path.join(process.cwd(), 'logs', timestamp);
  const screenshotsDir = path.join(logDir, 'screenshots');
  const conversationsDir = path.join(logDir, 'conversations');

  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(conversationsDir, { recursive: true });

  return logDir;
}

/**
 * Save a screenshot to the log directory
 */
async function saveScreenshot(
  logDir: string,
  screenshot: string | null | undefined,
  stepNumber: number
): Promise<void> {
  if (!screenshot) return;

  const screenshotPath = path.join(
    logDir,
    'screenshots',
    `step_${stepNumber}.png`
  );
  const buffer = Buffer.from(screenshot, 'base64');
  await fs.promises.writeFile(screenshotPath, buffer);
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
}

/**
 * Get an LLM based on available API keys
 * Priority: Azure OpenAI > OpenAI > Anthropic > Google Gemini
 */
async function getLLM(): Promise<BaseChatModel> {
  // Try Azure OpenAI first (enterprise-grade)
  if (process.env.AZURE_OPENAI_API_KEY) {
    // Set Azure environment variables for ChatAzure
    process.env.AZURE_OPENAI_ENDPOINT = AZURE_CONFIG.endpoint;
    process.env.AZURE_OPENAI_API_VERSION = AZURE_CONFIG.apiVersion;

    const { ChatAzure } = await import('../src/llm/azure/chat.js');
    console.log('🤖 Using Azure OpenAI LLM');
    console.log(`   Endpoint: ${AZURE_CONFIG.endpoint}`);
    console.log(`   Deployment: ${AZURE_CONFIG.deployment}`);
    return new ChatAzure(AZURE_CONFIG.deployment);
  }

  // Try OpenAI (reliable JSON output)
  if (process.env.OPENAI_API_KEY) {
    const { ChatOpenAI } = await import('../src/llm/openai/chat.js');
    console.log('🤖 Using OpenAI LLM (gpt-4o-mini)');
    return new ChatOpenAI('gpt-4o-mini');
  }

  // Try Anthropic before Google
  if (process.env.ANTHROPIC_API_KEY) {
    const { ChatAnthropic } = await import('../src/llm/anthropic/chat.js');
    console.log('🤖 Using Anthropic LLM (claude-sonnet-4-20250514)');
    return new ChatAnthropic('claude-sonnet-4-20250514');
  }

  // Fall back to Google
  if (process.env.GOOGLE_API_KEY) {
    const { ChatGoogle } = await import('../src/llm/google/chat.js');
    console.log('🤖 Using Google LLM (gemini-2.5-flash)');
    console.log(
      '⚠️  Note: Google LLM may have inconsistent JSON output. Consider using Azure or OpenAI.'
    );
    return new ChatGoogle('gemini-2.5-flash');
  }

  throw new Error(
    'No LLM API key found. Please set one of:\n' +
      '  - AZURE_OPENAI_API_KEY (recommended for enterprise)\n' +
      '  - OPENAI_API_KEY\n' +
      '  - ANTHROPIC_API_KEY\n' +
      '  - GOOGLE_API_KEY'
  );
}

async function main() {
  let llm: BaseChatModel;
  try {
    llm = await getLLM();
  } catch (error) {
    console.error('❌', (error as Error).message);
    console.log('\nTo run this example:');
    console.log('  1. Copy .env.example to .env');
    console.log(
      '  2. Add your AZURE_OPENAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY'
    );
    console.log('  3. Run: pnpm exec tsx examples/search-wikipedia.ts');
    process.exit(1);
  }

  // Create log directory for this run
  const logDir = createLogDirectory();
  console.log(`📁 Log directory: ${logDir}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let browserSession: BrowserSession | null = null;

  try {
    // Launch browser with Playwright in headless mode
    browser = await chromium.launch({
      headless: true, // Run in headless mode
    });

    context = await browser.newContext({
      viewport: VIEWPORT,
    });

    const page: Page = await context.newPage();

    // Navigate to the Wikipedia page first
    await page.goto('https://www.google.com/', {
      waitUntil: 'domcontentloaded',
    });

    // Create BrowserSession with the Playwright resources
    browserSession = new BrowserSession({
      browser,
      browser_context: context,
      page,
      url: page.url(),
      title: await page.title(),
      profile: {
        viewport: VIEWPORT,
      },
    });

    // Define the task for the Agent
    const task = `
      You are on the Wikipedia page for Test-driven Development.

      Task: Find and summarize the section about "Refactor as needed while ensuring all tests continue to pass".

      Steps:
      1. Use scroll_to_text to find the text "Refactor as needed" on the page
      2. Use extract_structured_data to extract the refactoring guidance content from that section
      3. Call done with success=true and include a 2-3 sentence summary of the refactoring guidance in the text field

      IMPORTANT: Do NOT use file system actions (read_file, write_file, replace_file_str).
      Complete this in 3 steps maximum using only browser actions and done.
    `;

    // Create custom controller that excludes file system actions
    // This prevents the LLM from getting confused by file system operations
    // which are unnecessary for simple browser tasks
    const controller = new Controller({
      exclude_actions: ['read_file', 'write_file', 'replace_file_str'],
    });

    // Create Agent with browser session using flash mode for simpler output
    const agent = new Agent({
      task,
      llm,
      browser_session: browserSession,
      controller, // Use custom controller with excluded file system actions
      page_extraction_llm: llm, // Use same LLM for page extraction
      use_vision: true,
      max_actions_per_step: 3,
      flash_mode: true, // Use simpler output format
      generate_gif: false,
      max_failures: 5, // Allow more retries for LLM parsing issues
      // Save conversation logs to the log directory
      save_conversation_path: path.join(logDir, 'conversations'),
      // Callback to save screenshots for each step
      register_new_step_callback: async (browserState, output, step) => {
        // Save screenshot for this step
        await saveScreenshot(logDir, browserState.screenshot, step);

        // Log step info
        const stepLogPath = path.join(
          logDir,
          'conversations',
          `step_${step}_info.txt`
        );
        const stepInfo = [
          `Step ${step}`,
          `URL: ${browserState.url}`,
          `Next Goal: ${output.current_state?.next_goal || 'N/A'}`,
          `Memory: ${output.current_state?.memory || 'N/A'}`,
          `Actions: ${JSON.stringify(output.action?.map((a: any) => Object.keys(a)[0]) || [])}`,
        ].join('\n');
        await fs.promises.writeFile(stepLogPath, stepInfo);
        console.log(`📝 Step ${step} info saved`);
      },
    });

    console.log('🚀 Starting browser-use Agent for Wikipedia research...\n');

    // Run the agent
    const history = await agent.run(20); // max 20 steps

    // Display results
    console.log('\n📊 Agent Results:');
    console.log('================');
    console.log(`Total steps: ${history.number_of_steps()}`);
    console.log(`Task completed: ${history.is_done()}`);
    console.log(`Task successful: ${history.is_successful()}`);

    const finalResult = history.final_result();
    if (finalResult) {
      console.log('\n📝 Final Result:');
      console.log(finalResult);
    }

    // Show action history summary
    const actionHistory = history.action_history();
    if (actionHistory && actionHistory.length > 0) {
      console.log('\n🔄 Actions taken:');
      actionHistory.forEach((actions, stepIndex) => {
        if (actions && actions.length > 0) {
          const actionNames = actions.map((a: any) =>
            typeof a === 'object' ? Object.keys(a)[0] : String(a)
          );
          console.log(`  Step ${stepIndex + 1}: ${actionNames.join(', ')}`);
        }
      });
    }

    // Check for errors
    const errors = history.errors();
    if (errors && errors.length > 0) {
      const significantErrors = errors.filter(
        (e) => e && !String(e).includes('Expected JSON')
      );
      if (significantErrors.length > 0) {
        console.log('\n⚠️ Errors encountered:');
        significantErrors.forEach((error) => console.log(`  - ${error}`));
      }
    }

    // Save run summary to log directory
    const summaryPath = path.join(logDir, 'run_summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      task: task.trim(),
      total_steps: history.number_of_steps(),
      is_done: history.is_done(),
      is_successful: history.is_successful(),
      final_result: finalResult,
      errors: errors?.filter((e) => e) || [],
    };
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\n📁 Run summary saved to: ${summaryPath}`);
  } catch (error) {
    console.error('❌ Agent failed:', error);
  } finally {
    // Cleanup
    await browserSession?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    console.log('\n✅ Browser session closed.');
    console.log(`📁 All logs saved to: ${logDir}`);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

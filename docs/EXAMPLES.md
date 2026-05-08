# Code Examples

Practical examples demonstrating Browser-Use capabilities.

## Table of Contents

- [Basic Examples](#basic-examples)
- [Data Extraction](#data-extraction)
- [Form Automation](#form-automation)
- [Multi-Tab Workflows](#multi-tab-workflows)
- [Custom Actions](#custom-actions)
- [Session Management](#session-management)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)

---

## Basic Examples

### Simple Web Search

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function webSearch() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Search Google for "TypeScript best practices 2024" and summarize the top 3 results',
    llm,
    use_vision: true,
  });

  const history = await agent.run(20);

  console.log('Success:', history.is_successful());
  console.log('Result:', history.final_result());
}

webSearch();
```

### Navigate and Screenshot

```typescript
import { Agent, BrowserSession, BrowserProfile } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function screenshotPage() {
  const profile = new BrowserProfile({
    headless: true,
    viewport: { width: 1920, height: 1080 },
  });

  const session = new BrowserSession({ browser_profile: profile });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Go to https://news.ycombinator.com and take a screenshot',
    llm,
    browser_session: session,
    generate_gif: './hacker-news-session.gif',
  });

  try {
    const history = await agent.run();
    console.log('Screenshot captured!');
  } finally {
    await session.stop();
  }
}

screenshotPage();
```

### Quick Task Execution

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function quickTask() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Go to github.com and find the trending TypeScript repositories',
    llm,
  });

  const history = await agent.run(30);

  console.log('URLs visited:', history.urls_visited());
  console.log('Result:', history.final_result());
}

quickTask();
```

---

## Data Extraction

### Extract Product Information

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function extractProducts() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to amazon.com and search for "wireless keyboard".
      Extract the following information from the first 5 products:
      - Product name
      - Price
      - Rating
      - Number of reviews
      Return as JSON.
    `,
    llm,
    use_vision: true,
  });

  const history = await agent.run(30);
  const result = history.final_result();

  // Parse the extracted JSON
  try {
    const products = JSON.parse(result);
    console.log('Extracted products:', products);
  } catch {
    console.log('Raw result:', result);
  }
}

extractProducts();
```

### Extract Table Data

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function extractTableData() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)
      Extract the GDP data for the top 10 countries from the first table.
      Return as a JSON array with fields: rank, country, gdp_millions
    `,
    llm,
    use_vision: true,
  });

  const history = await agent.run();
  console.log('GDP Data:', history.final_result());
}

extractTableData();
```

### Monitor Price Changes

```typescript
import { Agent, BrowserSession, BrowserProfile } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';
import * as fs from 'fs';

async function monitorPrice(productUrl: string) {
  const profile = new BrowserProfile({
    headless: true,
    user_data_dir: './price-monitor-profile', // Persist session
  });

  const session = new BrowserSession({ browser_profile: profile });

  const llm = new ChatOpenAI({
    model: 'gpt-4o-mini', // Cost-effective for simple extraction
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to ${productUrl}
      Extract the current price and product name.
      Return as JSON: { "product": "...", "price": "...", "timestamp": "..." }
    `,
    llm,
    browser_session: session,
  });

  try {
    const history = await agent.run(10);
    const result = history.final_result();

    // Append to price history file
    const priceData = JSON.parse(result);
    priceData.timestamp = new Date().toISOString();

    const historyFile = './price-history.json';
    let priceHistory = [];
    if (fs.existsSync(historyFile)) {
      priceHistory = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    }
    priceHistory.push(priceData);
    fs.writeFileSync(historyFile, JSON.stringify(priceHistory, null, 2));

    console.log('Price recorded:', priceData);
  } finally {
    await session.stop();
  }
}

// Run periodically
monitorPrice('https://www.amazon.com/dp/B08N5WRWNW');
```

---

## Form Automation

### Login with Credentials

```typescript
import { Agent, BrowserSession, BrowserProfile } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function loginToSite() {
  const profile = new BrowserProfile({
    headless: false, // Watch the login
    user_data_dir: './my-profile', // Persist cookies
  });

  const session = new BrowserSession({ browser_profile: profile });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to https://example.com/login
      Enter the username and password and click login.
      Wait for the dashboard to load.
    `,
    llm,
    browser_session: session,
    sensitive_data: {
      '*.example.com': {
        username: process.env.SITE_USERNAME!,
        password: process.env.SITE_PASSWORD!,
      },
    },
  });

  const history = await agent.run();
  console.log('Login successful:', history.is_successful());

  // Keep session for further use
  return session;
}

loginToSite();
```

### Fill Complex Form

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function fillApplicationForm() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const formData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'California',
    zip: '94105',
    country: 'United States',
  };

  const agent = new Agent({
    task: `
      Go to https://example.com/application
      Fill out the application form with the following information:
      ${JSON.stringify(formData, null, 2)}

      After filling all fields, click the Submit button.
      Confirm the submission was successful.
    `,
    llm,
    use_vision: true,
  });

  const history = await agent.run(40);
  console.log('Form submitted:', history.is_successful());
}

fillApplicationForm();
```

### Upload File

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';
import * as path from 'path';

async function uploadDocument() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const filePath = path.resolve('./documents/report.pdf');

  const agent = new Agent({
    task: `
      Go to https://example.com/upload
      Click the file upload button and upload the file at: ${filePath}
      Wait for the upload to complete and confirm success.
    `,
    llm,
    use_vision: true,
  });

  const history = await agent.run();
  console.log('Upload result:', history.final_result());
}

uploadDocument();
```

---

## Multi-Tab Workflows

### Compare Products Across Sites

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function compareProducts() {
  const session = new BrowserSession();

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Compare prices for "Sony WH-1000XM5 headphones" across these sites:
      1. Open amazon.com in the first tab and search for the product
      2. Open a new tab, go to bestbuy.com and search for the same product
      3. Open a new tab, go to walmart.com and search for the same product

      Extract the price from each site and provide a comparison summary
      showing which site has the best price.
    `,
    llm,
    browser_session: session,
    use_vision: true,
  });

  try {
    const history = await agent.run(50);
    console.log('Price Comparison:', history.final_result());
  } finally {
    await session.stop();
  }
}

compareProducts();
```

### Research with Multiple Sources

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function researchTopic() {
  const session = new BrowserSession();

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Research "quantum computing applications in medicine":

      1. Search Google and open the top 3 relevant results in separate tabs
      2. Read each article and extract key points
      3. Compile a summary that includes:
         - Main applications mentioned
         - Current status of research
         - Future predictions
         - Sources used

      Return a well-structured research summary.
    `,
    llm,
    browser_session: session,
    use_vision: true,
  });

  try {
    const history = await agent.run(60);
    console.log('Research Summary:', history.final_result());
  } finally {
    await session.stop();
  }
}

researchTopic();
```

---

## Custom Actions

### Screenshot Action

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { Controller } from 'browser-use/controller';
import { ActionResult } from 'browser-use/agent';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { z } from 'zod';
import * as fs from 'fs';

async function withScreenshots() {
  const controller = new Controller();

  // Register custom screenshot action
  controller.registry.action('Save screenshot to file', {
    param_model: z.object({
      filename: z.string().describe('Output filename (e.g., "screenshot.png")'),
      fullPage: z.boolean().optional().describe('Capture full page'),
    }),
  })(async function save_screenshot(params, ctx) {
    const screenshot = await ctx.page.screenshot({
      fullPage: params.fullPage ?? false,
    });

    const outputPath = `./screenshots/${params.filename}`;
    fs.mkdirSync('./screenshots', { recursive: true });
    fs.writeFileSync(outputPath, screenshot);

    return new ActionResult({
      extracted_content: `Screenshot saved to ${outputPath}`,
      attachments: [outputPath],
    });
  });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to https://github.com/trending
      Save a screenshot as "github-trending.png"
      Then scroll down and save another screenshot as "github-trending-2.png"
    `,
    llm,
    controller,
    use_vision: true,
  });

  await agent.run();
}

withScreenshots();
```

### Database Integration

```typescript
import { Agent } from 'browser-use';
import { Controller } from 'browser-use/controller';
import { ActionResult } from 'browser-use/agent';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { z } from 'zod';

// Simulated database
const database: any[] = [];

async function withDatabase() {
  const controller = new Controller();

  // Save to database action
  controller.registry.action('Save extracted data to database', {
    param_model: z.object({
      collection: z.string().describe('Collection name'),
      data: z.record(z.any()).describe('Data to save'),
    }),
  })(async function save_to_db(params) {
    database.push({
      collection: params.collection,
      data: params.data,
      timestamp: new Date().toISOString(),
    });

    return new ActionResult({
      extracted_content: `Saved to ${params.collection}: ${JSON.stringify(params.data)}`,
      include_in_memory: true,
    });
  });

  // Query database action
  controller.registry.action('Query saved data from database', {
    param_model: z.object({
      collection: z.string().describe('Collection to query'),
    }),
  })(async function query_db(params) {
    const results = database.filter((r) => r.collection === params.collection);

    return new ActionResult({
      extracted_content: JSON.stringify(results, null, 2),
    });
  });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to https://news.ycombinator.com
      Extract the top 5 stories with their titles and URLs
      Save each story to the database in the "stories" collection
      Then query the database to confirm the data was saved
    `,
    llm,
    controller,
    use_vision: true,
  });

  await agent.run();
  console.log('Database contents:', database);
}

withDatabase();
```

### Notification Action

```typescript
import { Agent } from 'browser-use';
import { Controller } from 'browser-use/controller';
import { ActionResult } from 'browser-use/agent';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { z } from 'zod';

async function withNotifications() {
  const controller = new Controller();

  // Send notification action
  controller.registry.action('Send notification', {
    param_model: z.object({
      channel: z.enum(['email', 'slack', 'console']),
      message: z.string(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    }),
  })(async function send_notification(params) {
    // In production, integrate with actual notification services
    console.log(
      `[${params.channel.toUpperCase()}] ${params.priority || 'medium'}: ${params.message}`
    );

    return new ActionResult({
      extracted_content: `Notification sent via ${params.channel}`,
    });
  });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: `
      Go to https://status.github.com
      Check if there are any ongoing incidents.
      If there are incidents, send a high priority notification to slack.
      If everything is operational, send a low priority notification to console.
    `,
    llm,
    controller,
    use_vision: true,
  });

  await agent.run();
}

withNotifications();
```

---

## Session Management

### Persistent Session

```typescript
import { Agent, BrowserSession, BrowserProfile } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function persistentSession() {
  // Use a dedicated profile directory for persistence
  const profile = new BrowserProfile({
    user_data_dir: './browser-profiles/main',
    headless: false,
  });

  const session = new BrowserSession({ browser_profile: profile });

  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // First run: Login and setup
  const agent1 = new Agent({
    task: 'Go to github.com and login with my credentials',
    llm,
    browser_session: session,
    sensitive_data: {
      '*.github.com': {
        username: process.env.GITHUB_USER!,
        password: process.env.GITHUB_PASS!,
      },
    },
  });

  await agent1.run();

  // Second run: Use existing session (already logged in)
  const agent2 = new Agent({
    task: 'Go to my GitHub notifications and summarize unread items',
    llm,
    browser_session: session, // Same session, preserves login
  });

  const history = await agent2.run();
  console.log('Notifications:', history.final_result());

  // Keep browser open for inspection
  // await session.stop();
}

persistentSession();
```

### Export and Import Session State

```typescript
import { BrowserSession, BrowserProfile } from 'browser-use';
import * as fs from 'fs';

async function exportSession() {
  const session = new BrowserSession();
  await session.start();

  // Do some browsing, login, etc...

  // Export storage state
  const context = session.browser_context!;
  const storageState = await context.storageState();

  fs.writeFileSync(
    './session-state.json',
    JSON.stringify(storageState, null, 2)
  );
  console.log('Session exported');

  await session.stop();
}

async function importSession() {
  const profile = new BrowserProfile({
    storage_state: './session-state.json',
  });

  const session = new BrowserSession({ browser_profile: profile });
  await session.start();

  // Session is restored with cookies, localStorage, etc.
  console.log('Session imported');

  return session;
}
```

### Multiple Independent Sessions

```typescript
import { Agent, BrowserSession, BrowserProfile } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function parallelSessions() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create independent sessions
  const session1 = new BrowserSession({
    browser_profile: new BrowserProfile({
      user_data_dir: './profiles/session1',
    }),
  });

  const session2 = new BrowserSession({
    browser_profile: new BrowserProfile({
      user_data_dir: './profiles/session2',
    }),
  });

  // Run tasks in parallel
  const [result1, result2] = await Promise.all([
    (async () => {
      const agent = new Agent({
        task: 'Search Google for "TypeScript 5.0 features"',
        llm,
        browser_session: session1,
      });
      return agent.run();
    })(),
    (async () => {
      const agent = new Agent({
        task: 'Search Bing for "TypeScript 5.0 features"',
        llm,
        browser_session: session2,
      });
      return agent.run();
    })(),
  ]);

  console.log('Google result:', result1.final_result());
  console.log('Bing result:', result2.final_result());

  await Promise.all([session1.stop(), session2.stop()]);
}

parallelSessions();
```

---

## Error Handling

### Retry on Failure

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function withRetry() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Go to flaky-website.com and extract the data',
    llm,
    max_failures: 5, // Allow up to 5 consecutive failures
    retry_delay: 5, // Wait 5 seconds between retries
  });

  const history = await agent.run(30);

  if (history.is_successful()) {
    console.log('Success:', history.final_result());
  } else {
    console.log('Failed after retries');
    console.log('Errors:', history.errors());
  }
}

withRetry();
```

### Graceful Degradation

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { ChatOllama } from 'browser-use/llm/ollama';

async function withFallback() {
  let llm;
  let usedFallback = false;

  // Try primary LLM first
  try {
    llm = new ChatOpenAI({
      model: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
    });
    // Test the connection
    await llm.ainvoke([{ role: 'user', content: 'test' }]);
  } catch (error) {
    console.log('Primary LLM unavailable, using fallback');
    llm = new ChatOllama('llama3', 'http://localhost:11434');
    usedFallback = true;
  }

  const agent = new Agent({
    task: 'Search for the current weather in San Francisco',
    llm,
    use_vision: !usedFallback, // Disable vision for local models
  });

  const history = await agent.run(usedFallback ? 20 : 30); // Fewer steps for fallback
  console.log('Result:', history.final_result());
}

withFallback();
```

### Timeout Handling

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function withTimeouts() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Complete a complex multi-step workflow',
    llm,
    llm_timeout: 30, // 30s timeout for LLM calls
    step_timeout: 120, // 2min timeout per step
  });

  try {
    const history = await agent.run(50); // Max 50 steps
    console.log('Completed:', history.is_successful());
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('Task timed out');
    } else {
      throw error;
    }
  }
}

withTimeouts();
```

---

## Advanced Patterns

### Event-Driven Monitoring

```typescript
import { Agent } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function eventDrivenAgent() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const agent = new Agent({
    task: 'Navigate through example.com and find the contact page',
    llm,
  });

  // Listen to per-agent events
  agent.eventbus.on('CreateAgentStepEvent', (event) => {
    console.log(`Step ${event.step_id}:`, event.model_output?.next_goal);
  });

  await agent.run();
}

eventDrivenAgent();
```

### Agent with Memory

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function agentWithMemory() {
  const session = new BrowserSession();
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // First task
  const agent1 = new Agent({
    task: `
      Go to a shopping site and search for "laptop".
      Find the cheapest option and remember its name and price.
    `,
    llm,
    browser_session: session,
  });

  await agent1.run();

  // Follow-up task using agent's ability to continue
  agent1.add_new_task(`
    Now search for "laptop case" that would fit the laptop you found.
    Compare prices and recommend the best option.
  `);

  const history = await agent1.run();
  console.log('Recommendation:', history.final_result());

  await session.stop();
}

agentWithMemory();
```

### Replay Actions

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';
import * as fs from 'fs';

async function recordAndReplay() {
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Record session
  const agent = new Agent({
    task: 'Login to example.com and navigate to settings',
    llm,
    save_conversation_path: './recordings',
  });

  const history = await agent.run();

  // Save history for replay
  fs.writeFileSync(
    './recordings/history.json',
    JSON.stringify(history.history, null, 2)
  );

  // Later: Replay the recorded actions
  const newSession = new BrowserSession();
  const replayAgent = new Agent({
    task: 'Replay recorded actions',
    llm,
    browser_session: newSession,
  });

  const savedHistory = JSON.parse(
    fs.readFileSync('./recordings/history.json', 'utf-8')
  );

  await replayAgent.rerun_history(savedHistory, {
    max_retries: 3,
    skip_failures: true,
  });

  await newSession.stop();
}

recordAndReplay();
```

### Conditional Workflows

```typescript
import { Agent, BrowserSession } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';

async function conditionalWorkflow() {
  const session = new BrowserSession();
  const llm = new ChatOpenAI({
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Step 1: Check status
  const checkAgent = new Agent({
    task: `
      Go to https://status.example.com
      Check if all services are operational.
      Return "operational" if everything is green, otherwise "degraded".
    `,
    llm,
    browser_session: session,
  });

  const checkHistory = await checkAgent.run(10);
  const status = checkHistory.final_result().toLowerCase();

  // Step 2: Conditional action
  if (status.includes('operational')) {
    console.log('All systems operational, proceeding with deployment');

    const deployAgent = new Agent({
      task: 'Go to deploy.example.com and trigger the production deployment',
      llm,
      browser_session: session,
    });

    await deployAgent.run();
  } else {
    console.log('Systems degraded, skipping deployment');

    const alertAgent = new Agent({
      task: 'Go to alerts.example.com and create a new incident report',
      llm,
      browser_session: session,
    });

    await alertAgent.run();
  }

  await session.stop();
}

conditionalWorkflow();
```

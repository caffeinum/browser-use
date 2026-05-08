# Actions Guide

Actions are the building blocks of browser automation in Browser-Use. This guide covers built-in actions and how to create custom actions.

## Action System Overview

Actions are registered through a decorator-based registry system:

```typescript
registry.action(description, options)(handler);
```

The agent uses LLM to decide which actions to execute based on:

1. Current page state
2. Task description
3. Available actions and their descriptions

## Built-in Actions

### Navigation Actions

#### go_to_url

Navigate to a URL.

```typescript
// Schema
{
  url: z.string().url(),
  new_tab: z.boolean().optional().default(false)
}

// Example LLM output
{ "go_to_url": { "url": "https://example.com" } }
{ "go_to_url": { "url": "https://google.com", "new_tab": true } }
```

#### go_back

Navigate back in browser history.

```typescript
// Schema
{}  // No parameters

// Example
{ "go_back": {} }
```

#### search_google

Search Google directly.

```typescript
// Schema
{
  query: z.string()
}

// Example
{ "search_google": { "query": "TypeScript tutorials" } }
```

---

### Element Interaction Actions

#### click_element

Click an element by its index.

```typescript
// Schema
{
  index: z.number().int().min(0)
}

// Example (click element #5)
{ "click_element": { "index": 5 } }
```

#### input_text

Type text into an input field.

```typescript
// Schema
{
  index: z.number().int().min(0),
  text: z.string(),
  press_enter: z.boolean().optional().default(false)
}

// Example
{ "input_text": { "index": 3, "text": "Hello World" } }
{ "input_text": { "index": 3, "text": "search query", "press_enter": true } }
```

#### send_keys

Send keyboard commands.

```typescript
// Schema
{
  keys: z.string()  // Playwright key notation
}

// Examples
{ "send_keys": { "keys": "Enter" } }
{ "send_keys": { "keys": "Control+a" } }
{ "send_keys": { "keys": "Escape" } }
```

#### select_dropdown

Select an option from a dropdown.

```typescript
// Schema
{
  index: z.number().int().min(0),
  value: z.string()
}

// Example
{ "select_dropdown": { "index": 7, "value": "Option 2" } }
```

---

### Scrolling Actions

#### scroll

Scroll the page by a specified amount.

```typescript
// Schema
{
  direction: z.enum(['up', 'down']),
  amount: z.number().optional()  // Pixels or "page" units
}

// Examples
{ "scroll": { "direction": "down" } }
{ "scroll": { "direction": "up", "amount": 500 } }
```

#### scroll_to_text

Scroll until specific text is visible.

```typescript
// Schema
{
  text: z.string()
}

// Example
{ "scroll_to_text": { "text": "Contact Us" } }
```

---

### Tab Management Actions

#### switch_tab

Switch to a different tab.

```typescript
// Schema
{
  page_id: z.number().int()
}

// Example
{ "switch_tab": { "page_id": 2 } }
```

#### open_tab

Open a new tab.

```typescript
// Schema
{
  url: z.string().url().optional()
}

// Examples
{ "open_tab": {} }  // Blank tab
{ "open_tab": { "url": "https://example.com" } }
```

#### close_tab

Close current or specified tab.

```typescript
// Schema
{
  page_id: z.number().int().optional()
}

// Example
{ "close_tab": {} }  // Close current
{ "close_tab": { "page_id": 3 } }  // Close specific
```

---

### Content Extraction Actions

#### extract_structured_data

Extract structured data from the page using LLM.

```typescript
// Schema
{
  instruction: z.string(),
  schema: z.record(z.any()).optional()
}

// Example
{
  "extract_structured_data": {
    "instruction": "Extract all product names and prices",
    "schema": {
      "products": [{ "name": "string", "price": "number" }]
    }
  }
}
```

#### dropdown_options

Get available options from a dropdown.

```typescript
// Schema
{
  index: z.number().int().min(0)
}

// Example
{ "dropdown_options": { "index": 5 } }
```

---

### File Actions

#### upload_file

Upload a file to a file input.

```typescript
// Schema
{
  index: z.number().int().min(0),
  path: z.string()
}

// Example
{ "upload_file": { "index": 2, "path": "/path/to/file.pdf" } }
```

#### read_file

Read contents of a file.

```typescript
// Schema
{
  path: z.string()
}

// Example
{ "read_file": { "path": "./data/config.json" } }
```

#### write_file

Write content to a file.

```typescript
// Schema
{
  path: z.string(),
  content: z.string(),
  append: z.boolean().optional().default(false)
}

// Examples
{ "write_file": { "path": "./output.txt", "content": "Hello" } }
{ "write_file": { "path": "./log.txt", "content": "New entry", "append": true } }
```

#### replace_file_str

Replace text in a file.

```typescript
// Schema
{
  path: z.string(),
  old_str: z.string(),
  new_str: z.string()
}

// Example
{
  "replace_file_str": {
    "path": "./config.json",
    "old_str": "\"debug\": false",
    "new_str": "\"debug\": true"
  }
}
```

---

### Control Actions

#### done

Mark the task as complete.

```typescript
// Schema
{
  text: z.string(),
  success: z.boolean().optional().default(true)
}

// Examples
{ "done": { "text": "Successfully completed the task", "success": true } }
{ "done": { "text": "Could not find the element", "success": false } }
```

#### wait

Wait for a specified duration.

```typescript
// Schema
{
  seconds: z.number().min(0).max(30)
}

// Example
{ "wait": { "seconds": 2 } }
```

---

## Creating Custom Actions

### Basic Custom Action

```typescript
import { Controller } from 'browser-use/controller';
import { ActionResult } from 'browser-use/agent';
import { z } from 'zod';

const controller = new Controller();

// Register a custom action
controller.registry.action('Take a screenshot and save it', {
  param_model: z.object({
    filename: z.string().describe('Output filename'),
  }),
})(async function save_screenshot(params, ctx) {
  const screenshot = await ctx.page.screenshot();
  await fs.writeFile(params.filename, screenshot);

  return new ActionResult({
    extracted_content: `Screenshot saved to ${params.filename}`,
    success: true,
  });
});
```

### Action with Domain Restrictions

```typescript
controller.registry.action('Login to example.com', {
  param_model: z.object({
    username: z.string(),
    password: z.string(),
  }),
  allowed_domains: ['*.example.com', 'login.example.org'],
})(async function example_login(params, ctx) {
  // This action only appears when on matching domains
  await ctx.page.fill('#username', params.username);
  await ctx.page.fill('#password', params.password);
  await ctx.page.click('#login-button');

  return new ActionResult({
    extracted_content: 'Logged in successfully',
  });
});
```

### Action with Page Filter

```typescript
controller.registry.action('Submit the checkout form', {
  param_model: z.object({}),
  page_filter: (page) => page.url().includes('/checkout'),
})(async function submit_checkout(params, ctx) {
  // Only available on checkout pages
  await ctx.page.click('#submit-order');

  return new ActionResult({
    extracted_content: 'Order submitted',
    is_done: true,
    success: true,
  });
});
```

### Action Using Browser Session

```typescript
controller.registry.action('Open URL in new tab', {
  param_model: z.object({
    url: z.string().url(),
  }),
})(async function open_in_new_tab(params, ctx) {
  // Access the browser session
  const session = ctx.browser_session;
  const newPage = await session.browser_context.newPage();
  await newPage.goto(params.url);

  return new ActionResult({
    extracted_content: `Opened ${params.url} in new tab`,
  });
});
```

### Action with Sensitive Data

```typescript
controller.registry.action('Fill login form with credentials', {
  param_model: z.object({
    username_field: z.number().int(),
    password_field: z.number().int(),
  }),
})(async function fill_login(params, ctx) {
  // ctx.has_sensitive_data indicates if sensitive data is available
  if (!ctx.has_sensitive_data) {
    return new ActionResult({
      error: 'No credentials provided',
    });
  }

  // Sensitive data is automatically replaced in action params
  // Use <secret>key</secret> pattern in text params

  return new ActionResult({
    extracted_content: 'Login form filled',
  });
});
```

### Async Action with Progress

```typescript
controller.registry.action('Process multiple items', {
  param_model: z.object({
    items: z.array(z.string()),
  }),
})(async function process_items(params, ctx) {
  const results = [];

  for (const item of params.items) {
    // Process each item
    await ctx.page.fill('#search', item);
    await ctx.page.click('#search-btn');
    await ctx.page.waitForLoadState('networkidle');

    const result = await ctx.page.textContent('#result');
    results.push(result);
  }

  return new ActionResult({
    extracted_content: JSON.stringify(results),
    include_in_memory: true,
  });
});
```

---

## ActionResult Properties

| Property            | Type       | Description                                  |
| ------------------- | ---------- | -------------------------------------------- |
| `is_done`           | `boolean`  | Marks task as complete                       |
| `success`           | `boolean`  | Whether action succeeded (only with is_done) |
| `error`             | `string`   | Error message if action failed               |
| `extracted_content` | `string`   | Content to return to LLM                     |
| `long_term_memory`  | `string`   | Persistent memory across steps               |
| `attachments`       | `string[]` | File paths to attach                         |
| `include_in_memory` | `boolean`  | Include in LLM history                       |

### Result Patterns

```typescript
// Successful action
return new ActionResult({
  extracted_content: 'Action completed successfully',
});

// Action with error
return new ActionResult({
  error: 'Element not found',
  include_in_memory: true,
});

// Task completion
return new ActionResult({
  extracted_content: 'Task finished',
  is_done: true,
  success: true,
});

// Task failure
return new ActionResult({
  extracted_content: 'Could not complete task',
  is_done: true,
  success: false,
});

// With long-term memory
return new ActionResult({
  extracted_content: 'Found user ID: 12345',
  long_term_memory: 'User ID is 12345 for future reference',
});
```

---

## Excluding Built-in Actions

To exclude specific built-in actions:

```typescript
const controller = new Controller({
  exclude_actions: ['upload_file', 'write_file', 'read_file'],
});
```

---

## Action Prompt Description

Actions automatically generate descriptions for the LLM:

```typescript
const description = controller.registry.get_prompt_description();
console.log(description);
// Output:
// Navigate to URL:
// {go_to_url: {"url": {"type": "string"}, "new_tab": {"type": "boolean", "default": false}}}
//
// Click an element:
// {click_element: {"index": {"type": "number"}}}
// ...
```

For page-specific actions:

```typescript
// Only get actions available on current page
const pageActions = controller.registry.get_prompt_description(page);
```

---

## Best Practices

### 1. Write Clear Descriptions

```typescript
// Good
controller.registry.action(
  'Click the submit button to complete the form submission',
  options
)(handler);

// Bad
controller.registry.action('Submit', options)(handler);
```

### 2. Use Descriptive Parameter Names

```typescript
// Good
param_model: z.object({
  search_query: z.string().describe('The text to search for'),
  max_results: z.number().describe('Maximum number of results to return'),
});

// Bad
param_model: z.object({
  q: z.string(),
  n: z.number(),
});
```

### 3. Handle Errors Gracefully

```typescript
async function my_action(params, ctx) {
  try {
    await ctx.page.click(params.selector);
    return new ActionResult({ success: true });
  } catch (error) {
    return new ActionResult({
      error: `Failed to click: ${error.message}`,
      include_in_memory: true,
    });
  }
}
```

### 4. Use Domain Restrictions for Sensitive Actions

```typescript
// Restrict login actions to specific domains
controller.registry.action('Login', {
  allowed_domains: ['*.mysite.com'],
})(login_handler);
```

### 5. Return Meaningful Content

```typescript
// Good - provides useful information
return new ActionResult({
  extracted_content:
    'Found 15 search results. Top result: "TypeScript Handbook"',
});

// Bad - not informative
return new ActionResult({
  extracted_content: 'Done',
});
```

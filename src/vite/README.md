# vite-plugin-webext-messaging

Auto-generate TypeScript types for [@davestewart/webext-messaging](https://github.com/davestewart/webext-messaging) routes. Get fully-typed message sending without manual type imports!

## Features

- 🎯 **Zero-config typing** - Import and use, types are automatic
- 🔄 **Auto-discovery** - Scans your codebase for route definitions
- ⚡ **HMR support** - Updates types on file changes
- 🎨 **Great DX** - Full autocomplete and type safety
- 📦 **Framework agnostic** - Works with any Vite-based setup

## Installation
```bash
pnpm add -D vite-plugin-webext-messaging
pnpm add @davestewart/webext-messaging
```

## Setup

### 1. Add plugin to vite.config.ts
```ts
import { defineConfig } from 'vite'
import { messageRoutesPlugin } from 'vite-plugin-webext-messaging'

export default defineConfig({
  plugins: [
    messageRoutesPlugin({
      include: ['src/**/*.ts'],    // Where to scan for routes
      outputDir: '.wxt',            // Where to generate types
      tsconfig: 'tsconfig.json'     // Your tsconfig path
    })
  ]
})
```

### 2. Update tsconfig.json

Add the path mapping for the generated module:
```json
{
  "compilerOptions": {
    "paths": {
      "#messaging": ["./.wxt/messaging.ts"]
    }
  }
}
```

### 3. Define your routes
```ts
// background/routes.ts
import { defineMessageRoutes } from '@davestewart/webext-messaging'

export const routes = defineMessageRoutes({
  'background:window/get': async ({ id }: { id: number }) => {
    const windows = await chrome.windows.get(id)
    return windows
  },
  
  'background:tabs/list': async () => {
    return chrome.tabs.query({})
  }
})
```

### 4. Create a router
```ts
// background/index.ts
import { createMessageRouter } from '@davestewart/webext-messaging'
import { routes } from './routes'

createMessageRouter(routes)
```

### 5. Send messages (fully typed!)
```ts
// content/index.ts
import { sendMessage } from '#messaging'

// ✨ Fully typed - knows all routes, payloads, and return types!
const window = await sendMessage('background:window/get', { id: 123 })
//    ^ Type: chrome.windows.Window

const tabs = await sendMessage('background:tabs/list')
//    ^ Type: chrome.tabs.Tab[]
```

## How it works

1. **Scan phase**: The plugin scans your codebase for `defineMessageRoutes()`, `createMessageRouter()`, and `createPortRouter()` calls
2. **Extract phase**: Uses ts-morph to extract route paths, parameter types, and return types
3. **Generate phase**: Creates `.wxt/messaging.ts` with:
  - `MessageRoutes` interface with all discovered routes
  - Pre-configured `sendMessage()` and `sendMessageTo()` functions
  - Typed router creators

## Configuration

### Options
```ts
interface MessageRoutesPluginOptions {
  /**
   * Glob patterns for files to scan
   * @default ['src/**\/*.{ts,tsx}']
   */
  include?: string[]
  
  /**
   * Output directory for generated files
   * @default '.wxt'
   */
  outputDir?: string
  
  /**
   * Path to tsconfig.json
   * @default 'tsconfig.json'
   */
  tsconfig?: string
}
```

### Example: Custom configuration
```ts
messageRoutesPlugin({
  include: [
    'src/background/**/*.ts',
    'src/content/**/*.ts',
    'src/sidepanel/**/*.ts'
  ],
  outputDir: 'generated',
  tsconfig: './tsconfig.app.json'
})
```

## Generated API

The plugin generates `.wxt/messaging.ts` with the following exports:

### Pre-configured senders
```ts
import { sendMessage, sendMessageTo } from '#messaging'

// Send to default target
await sendMessage('route/path', payload)

// Send to specific tab or extension
await sendMessageTo(tabId, 'route/path', payload)
await sendMessageTo('extension-id', 'route/path', payload)
```

### Typed router creators
```ts
import { createRouter, createPortRouter } from '#messaging'

// Create routers with autocomplete for your routes
const router = createRouter({
  'my:route': (payload) => { /* ... */ }
})
```

### Custom sender instances
```ts
import { createSender, createPortSender } from '#messaging'

// Create senders with custom options
const sender = createSender({ 
  logger: myLogger,
  onError: handleError
})
```

## Examples

### Multiple route files
```ts
// background/window-routes.ts
export const windowRoutes = defineMessageRoutes({
  'background:window/get': async ({ id }: { id: number }) => { /* ... */ },
  'background:window/create': async ({ url }: { url: string }) => { /* ... */ }
})

// background/tab-routes.ts  
export const tabRoutes = defineMessageRoutes({
  'background:tabs/list': async () => { /* ... */ },
  'background:tabs/close': async ({ id }: { id: number }) => { /* ... */ }
})

// background/index.ts - combine them
import { createMessageRouter } from '@davestewart/webext-messaging'

createMessageRouter({
  ...windowRoutes,
  ...tabRoutes
})
```

### Sending to specific tabs
```ts
import { sendMessageTo } from '#messaging'

// Get active tab
const [tab] = await chrome.tabs.query({ active: true })

// Send message to that specific tab
await sendMessageTo(tab.id!, 'content:highlight', { color: 'yellow' })
```

### Long-lived connections
```ts
// Background: setup port router
import { createPortRouter } from '#messaging'

const routes = defineMessageRoutes({
  'stream:data': ({ chunk }: { chunk: string }) => {
    console.log('Received chunk:', chunk)
  }
})

createPortRouter(routes, { name: 'data-stream' })

// Content: send via port
import { createPortSender } from '#messaging'

const sender = createPortSender({ 
  name: 'data-stream',
  timeout: 5000 
})

await sender.sendMessage('stream:data', { chunk: 'hello' })
```

## Troubleshooting

### Types not updating

1. Restart TypeScript server: `Cmd/Ctrl + Shift + P` → "Restart TypeScript Server"
2. Check `.wxt/messaging.ts` was generated
3. Verify `#messaging` alias in tsconfig.json

### "Cannot find module '#messaging'"

- Make sure `paths` is set in tsconfig.json
- Restart your dev server
- Check that route definitions exist in scanned files

### Routes not detected

- Ensure you're using `defineMessageRoutes()`, `createMessageRouter()`, or `createPortRouter()`
- Check that files match your `include` glob patterns
- Look for parsing errors in console

### Type resolution issues

- Install `@types/chrome` in your project
- Make sure your tsconfig is properly configured
- Check that imported types are available in your project

## Related

- [@davestewart/webext-messaging](https://github.com/davestewart/webext-messaging) - The messaging library this plugin generates types for
- [WXT](https://wxt.dev) - Next-gen web extension framework

## License

MIT

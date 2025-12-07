# WebExt Message Router

> Type-safe, message routing for Chrome browser extensions.

## Abstract

A lightweight but full-featured Chrome extension messaging library.

lightweight abstraction over Chrome's extension messaging APIs that provides type-safe communication between extension contexts (background, content scripts, popup, sidepanel, etc.) with support for both one-time requests and long-lived connections

Set up structured, type-safe messaging between different parts of your Chrome extension with ease:

```ts
createMessageRouter(defineMessageRoutes({
  'path/to/handler': async (payload, sender) => {
    // handle message
    return response
  },
  // more routes...
}))
```

Set up **routes** and **routers** in processes that handle requests, and **messengers** in processes that send requests:

- **Routes** are just objects mapping paths to handler functions
- **Routers** register these handlers to listen for incoming messages
- **Messengers** call these handlers remotely with full type safety

Set up multiple routers and messengers as needed for:

- different concerns (auth, tabs, etc.)
- different contexts (background, content scripts, popup, sidepanel, etc.).

## Features

DX:

- **Type-safe** - Full TypeScript support with autocomplete for routes and payloads
- **IDE integration** - Click to navigate from messenger routes to handler implementation
- **Lightweight** - No dependencies or build process

Functionality:

- **One-time requests** - Simple request/response pattern using `runtime.sendMessage`
- **Long-lived connections** - Port-based messaging for streaming or ongoing communication
- **Proxying** - Forward messages from content scripts to other contexts
- **Enable/disable** - Dynamically enable or disable routers

Robustness:

- **Error handling** - Comprehensive error handling with optional callbacks
- **Timeout handling** - Configurable timeouts with proper cleanup
- **Logging** - Optional logging for debugging and monitoring

## Quick Start

### One-time Messaging

```ts
// background/messaging.ts
const routes = {
  'auth.login': async ({ email, password }) => {
    const token = await authenticate(email, password)
    return { token }
  },
  'storage.get': async ({ key }) => {
    return await chrome.storage.local.get(key)
  }
}

export type Routes = typeof routes
export const router = createRouter(routes)
```

```ts
// content/main.ts
import { createMessenger } from './messaging'
import type { Routes } from '@/background/messaging'

const messenger = createMessenger<Routes>()
const result = await messenger.sendMessage('auth.login', { 
  email: 'user@example.com', 
  password: 'secret' 
})
```

### Port-based Messaging

```ts
// sidepanel/messaging.ts
const routes = {
  'data.subscribe': async ({ query }) => {
    return await fetchData(query)
  }
}

export type Routes = typeof routes
export const router = createPortRouter(routes, { name: 'sidepanel' })
```

```ts
// background/main.ts
import { createPortMessenger } from './messaging'
import type { Routes } from '@/sidepanel/messaging'

const messenger = createPortMessenger<Routes>({ name: 'sidepanel' })
const data = await messenger.sendMessage('data.subscribe', { query: 'latest' })
messenger.close()
```

### Proxying

Extension content scripts cannot directly communicate with other extension contexts (popup, sidepanel, etc.).

Set up proxying in background to forward messages and return responses:

```ts
// background: proxy messages with specific prefixes
createRouter(routes, {
  proxy: ['sidepanel:*', 'popup:*'] // or `true` to proxy all
})
```

```ts
// content script: send to background (auto-forwards to sidepanel)
messenger.sendMessage('sidepanel:update', { data })
```

## Autocomplete

Export route types to get full autocomplete across processes:

```ts
// background/messaging/index.ts
const routes = {
  'auth.login': async ({ email, password }) => { ... },
  'tabs.create': async ({ url }) => { ... }
}

export type Routes = typeof routes
export const router = createRouter(routes)
```

```ts
// content/main.ts
import { createMessenger } from './messaging'
import type { Routes } from '@/background/messaging'

const messenger = createMessenger<Routes>()

// Full autocomplete for routes and payloads!
await messenger.sendMessage('auth.login', { email: '...', password: '...' })
await messenger.sendMessage('tabs.create', { url: '...' })
```

## Combining Routes

Organize routes into logical groups and combine them:

```ts
// background/messaging/routes/tabs.ts
export const tabs = {
  'tabs.create': async ({ url }) => { ... },
  'tabs.close': async ({ id }) => { ... },
  'tabs.query': async ({ active }) => { ... }
}
```

```ts
// background/messaging/routes/windows.ts
export const windows = {
  'windows.create': async ({ url }) => { ... },
  'windows.close': async ({ id }) => { ... },
  'windows.query': async () => { ... }
}
```

```ts
// background/messaging/index.ts
import { tabs } from './routes/tabs'
import { windows } from './routes/windows'

const routes = {
  ...tabs,
  ...windows
}

export type Routes = typeof routes
export const router = createRouter(routes)
```

## Prefixes

Use prefixes to namespace routes and enable selective proxying:

```ts
// Group related routes with prefixes
const routes = {
  'sidepanel:init': async () => { ... },
  'sidepanel:update': async ({ data }) => { ... },
  'sidepanel:close': async () => { ... },
  
  'popup:open': async () => { ... },
  'popup:getData': async () => { ... }
}
```

```ts
// Or use path-based organization
const routes = {
  'api/users/get': async ({ id }) => { ... },
  'api/users/create': async ({ data }) => { ... },
  'api/posts/get': async ({ id }) => { ... },
  'api/posts/create': async ({ data }) => { ... }
}
```

See [proxy](#proxying) section above for forwarding based on prefixes.

## Examples

### Authentication Flow

```ts
// background: handle auth state
const routes = {
  'auth.login': async ({ email, password }) => {
    const { token } = await api.login(email, password)
    await chrome.storage.local.set({ token })
    return { success: true }
  },
  'auth.logout': async () => {
    await chrome.storage.local.remove('token')
    return { success: true }
  },
  'auth.getUser': async () => {
    const { token } = await chrome.storage.local.get('token')
    return await api.getUser(token)
  }
}
```

### Real-time Data Sync

```ts
// sidepanel: stream updates via port
const routes = {
  'data.subscribe': async ({ filter }) => {
    // Initial data
    return await fetchData(filter)
  }
}

const router = createPortRouter(routes, { name: 'sync' })

// Broadcast updates to connected ports
setInterval(() => {
  const updates = getLatestUpdates()
  // Send via port.postMessage to all connected clients
}, 1000)
```

### Cross-context Communication

```ts
// content script wants to update sidepanel UI
const messenger = createMessenger<BackgroundRoutes>()

// Background proxies to sidepanel
await messenger.sendMessage('sidepanel:highlight', { 
  selector: '.important',
  color: 'yellow' 
})
```

### API Wrapper

```ts
// background: wrap external API with type-safe routes
const routes = {
  'api.search': async ({ query, limit }) => {
    const results = await fetch(`/api/search?q=${query}&limit=${limit}`)
    return await results.json()
  },
  'api.analyze': async ({ text }) => {
    const analysis = await ai.analyze(text)
    return { sentiment: analysis.sentiment, entities: analysis.entities }
  }
}
```

## API

### `createRouter<T>(routes, options?)`

Creates a router for handling incoming one-time messages.

**Parameters:**
- `routes: T extends Routes` - Object mapping route paths to handler functions
- `options?: RouterOptions`
  - `enabled?: boolean` - Initial enabled state (default: `true`)
  - `logger?: Logger` - Optional logger instance
  - `proxy?: boolean | string[]` - Proxy unhandled routes (patterns like `'sidepanel:*'`)

**Returns:**
- `call(path, payload)` - Manually invoke a handler
- `enable()` - Enable the router
- `disable()` - Disable the router

### `createMessenger<T>(options?)`

Creates a messenger for sending one-time messages.

**Parameters:**
- `options?: MessengerOptions`
  - `tabId?: number` - Default tab to send to
  - `extensionId?: string` - Default extension to send to
  - `logger?: Logger` - Optional logger instance
  - `onError?: (error) => void` - Error callback

**Returns:**
- `sendMessage(path, payload, id?)` - Send a message, optionally targeting specific tab/extension
- `sendMessageTo(id, path, payload)` - Send a message to specific tab (`number`) or extension (`string`)

### `createPortRouter<T>(routes, options?)`

Creates a router for handling incoming port messages.

**Parameters:**
- `routes: T extends Routes` - Object mapping route paths to handler functions
- `options?: PortRouterOptions`
  - `name?: string` - Port connection name
  - `tabId?: number` - Connect to specific tab
  - `extensionId?: string` - Connect to specific extension
  - `enabled?: boolean` - Initial enabled state (default: `true`)
  - `logger?: Logger` - Optional logger instance

**Returns:**
- `call(path, payload)` - Manually invoke a handler
- `enable()` - Enable the router
- `disable()` - Disable the router

### `createPortMessenger<T>(options?)`

Creates a messenger for sending port messages.

**Parameters:**
- `options?: PortMessengerOptions`
  - `name?: string` - Port connection name
  - `tabId?: number` - Connect to specific tab
  - `extensionId?: string` - Connect to specific extension
  - `timeout?: number` - Request timeout in ms (default: `30000`)
  - `logger?: Logger` - Optional logger instance
  - `onError?: (error) => void` - Error callback

**Returns:**
- `sendMessage(path, payload)` - Send a message over the port
- `connected` - Getter for connection state
- `port` - Getter for underlying `chrome.runtime.Port` instance
- `close()` - Close the port connection

## License

MIT

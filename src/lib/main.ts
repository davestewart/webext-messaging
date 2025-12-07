import { executeMessageHandler, sendMessageRequest } from './core'
import {
  MessageRequest,
  MessageSenderOptions,
  PortRequest,
  PortResponse,
  PortRouterOptions,
  PortSenderOptions,
  MessageHandler,
  RouteRecords,
  RouterOptions,
} from './types'

// ---------------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Convert a handler's input type to the appropriate rest parameter tuple
 */
type PayloadArgs<T> = undefined extends T
  ? [T?]           // optional parameter
  : T extends undefined | void
    ? []           // no parameter
    : [T]          // required parameter

/**
 * Build core router functionality
 *
 * @param routes            An object mapping routes to handler functions
 * @param addListener       A function to add the target listener (e.g., runtime.onMessage.addListener)
 * @param removeListener    A function to remove the target listener (e.g., runtime.onMessage.removeListener)
 * @param initialEnabled    The initial enabled-state of the router
 */
function createRouterCore<T extends RouteRecords> (
  routes: T,
  addListener: (() => void),
  removeListener: (() => void),
  initialEnabled: boolean = true,
) {
  // types
  type Path = keyof T & string
  type Input<P extends Path> = Parameters<T[P]>[0]
  type Output<P extends Path> = ReturnType<T[P]>

  /**
   * Call a route handler directly
   *
   * Useful if you want to keep routes instances private but still call them directly
   *
   * @param path      Path to the target route
   * @param payload   Optional route-specific payload
   */
  const call = <P extends Path> (path: P, payload?: Input<P>): Output<P> => {
    const handler = routes[path]
    if (!handler) {
      throw new Error(`Handler not found: ${path}`)
    }
    return handler(payload) as Output<P>
  }

  /**
   * Enable the router (starts listening to message events)
   */
  const enable = () => {
    if (!enabled) {
      addListener()
      enabled = true
    }
  }

  /**
   * Disable the router (stops listening to message events)
   */
  const disable = () => {
    if (enabled) {
      removeListener()
      enabled = false
    }
  }

  let enabled = initialEnabled
  if (enabled) {
    enable()
  }

  const r: Readonly<T> = routes

  return {
    call,
    enable,
    disable,
    get routes () {
      return r
    },
  }
}

/**
 * Define routes with proper typing
 *
 * @param routes
 */
export function defineMessageRoutes<T extends Record<string, MessageHandler>> (routes: T): T {
  return routes
}

// ---------------------------------------------------------------------------------------------------------------------
// one-time requests (send)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Create a one-time message router using chrome.runtime.onMessage
 *
 * @param routes    Hash of route => handler pairs
 * @param options   One-time router options
 */
export function createMessageRouter<T extends RouteRecords> (routes: T, options: RouterOptions = { enabled: true }) {
  // options
  const { logger, proxy } = options

  // check if the path should be proxied
  const shouldProxy = (path: string): boolean => {
    // don't proxy
    if (!proxy) return false

    // proxy everything
    if (proxy === true) return true

    // check patterns like 'sidepanel:*' or 'content:windows/*'
    return proxy.some((pattern: string) => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        return path.startsWith(prefix)
      }
      return path === pattern
    })
  }

  // handler
  const onMessage = async (message: MessageRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    // variables
    const { path, payload } = message
    const handler = routes[path]

    // got handler
    if (handler) {
      const result = executeMessageHandler(handler.bind(routes), message, sendResponse, sender, logger)
      if (result) {
        return true // async
      }
    }

    // if no handler and should proxy, forward it
    else if (shouldProxy(path)) {
      logger?.info('Proxying:', path, payload)
      try {
        const data = await sendMessageRequest({ path, payload }, undefined, { logger })
        sendResponse({ data })
      }
      catch (error) {
        logger?.error('Proxy error:', path, error)
        sendResponse({ error })
      }
      return true // async
    }
  }

  // setup add / remove handlers
  const addListener = () => chrome.runtime.onMessage.addListener(onMessage)
  const removeListener = () => chrome.runtime.onMessage.removeListener(onMessage)

  // return
  return createRouterCore(routes, addListener, removeListener, options.enabled)
}

/**
 * Create a one-time message sender using chrome.runtime.sendMessage / chrome.tabs.sendMessage
 *
 * @param options   Options for the messenger
 */
export function createMessageSender<T extends RouteRecords> (options: MessageSenderOptions = {}) {
  // types
  type Path = keyof T & string
  type Input<P extends Path> = Parameters<T[P]>[0]
  type Output<P extends Path> = ReturnType<T[P]>

  /**
   * Send a message to a specific tab or extension
   *
   * @param targetId    Target tab id (number) or extension id (string)
   * @param path        Path to the target route
   * @param payload     Optional route-specific payload
   */
  async function sendMessageTo<P extends Path> (
    targetId: string | number,
    path: P,
    ...payload: PayloadArgs<Input<P>>
  ) {
    // variables
    const message = { path, payload: payload[0] }

    // send
    return await sendMessageRequest(message, targetId) as Promise<Output<P> | undefined>
  }

  /**
   * Send a message
   *
   * @param path      Path to the target route
   * @param payload   Optional route-specific payload
   */
  async function sendMessage<P extends Path> (
    path: P,
    ...payload: PayloadArgs<Input<P>>
  ): Promise<Output<P> | undefined> {
    // variables
    const message = { path, payload: payload[0] }
    const targetId = options.targetId

    // send
    return await sendMessageRequest(message, targetId) as Promise<Output<P> | undefined>
  }

  return {
    sendMessage,
    sendMessageTo,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// long-lived connections (ports)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Create a long-lived message router using chrome.runtime.connect / chrome.tabs.connect
 *
 * @param routes    Hash of route => handler pairs
 * @param options   Optional PortRouter options
 */
export function createPortRouter<T extends RouteRecords> (routes: T, options: PortRouterOptions = { enabled: true }) {
  // options
  const { logger, channel, targetId } = options

  // debug
  logger?.info(`Creating port router with connection: ${channel}`)

  // create port
  const port = typeof targetId === 'number'
    ? chrome.tabs.connect(targetId, { name: channel }) // specific tab
    : typeof targetId === 'string'
      ? chrome.runtime.connect(targetId, { name: channel }) // specific extension
      : chrome.runtime.connect({ name: channel }) // current extension

  // handler
  const onMessage = (message: PortRequest) => {
    const handler = routes[message.path]
    if (handler) {
      void executeMessageHandler(handler.bind(routes), message, port.postMessage, port.sender, logger)
    }
  }

  // setup add / remove handlers
  const addListener = () => port.onMessage.addListener(onMessage)
  const removeListener = () => port.onMessage.removeListener(onMessage)

  // return
  return createRouterCore(routes, addListener, removeListener, options.enabled)
}

/**
 * Create a long-lived messenger using chrome.runtime.connect / chrome.tabs.connect
 *
 * @param options Optional PortSender options
 */
export function createPortSender<T extends RouteRecords> (options: PortSenderOptions = {}) {
  // types
  type Path = keyof T & string
  type Input<P extends Path> = Parameters<T[P]>[0]
  type Output<P extends Path> = ReturnType<T[P]>

  // options
  const { onError, logger, channel, targetId, timeout = 30000 } = options

  // connection info
  let connected = true
  let closedIntentionally = false

  // create port
  const port = typeof targetId === 'number'
    ? chrome.tabs.connect(targetId, { name: channel }) // specific tab
    : typeof targetId === 'string'
      ? chrome.runtime.connect(targetId, { name: channel }) // specific extension
      : chrome.runtime.connect({ name: channel }) // current extension

  // track pending requests
  const pendingRequests = new Map<string, {
    timeoutId: number
    resolve: Function
    reject: Function
  }>()

  // handlers
  function onMessage (message: PortResponse) {
    const { id, data, error } = message
    const pending = pendingRequests.get(id!)
    if (pending) {
      error
        ? pending.reject(error)
        : pending.resolve(data)
      pendingRequests.delete(id!)
    }
  }

  function onDisconnect () {
    // clean up
    connected = false
    port.onMessage.removeListener(onMessage)
    port.onDisconnect.removeListener(onDisconnect)

    // error message
    const defaultError = new Error('Port disconnected')
    const error = !closedIntentionally
      ? chrome.runtime.lastError || defaultError
      : undefined

    // debug
    if (closedIntentionally) {
      logger?.info('Port closed')
    }
    else {
      logger?.error('Port disconnected with error:', error)
      onError?.(error)
    }

    // reject all pending requests
    for (const [_, { timeoutId, reject }] of pendingRequests) {
      clearTimeout(timeoutId)
      reject(closedIntentionally ? defaultError : error)
    }
    pendingRequests.clear()
  }

  function close () {
    closedIntentionally = true
    port.disconnect()
  }

  /**
   * Send a message through a port
   *
   * @param path      The path of a message handler
   * @param payload   Optional payload for the message handler
   */
  async function sendMessage<P extends Path> (
    path: P,
    ...payload: PayloadArgs<Input<P>>
  ): Promise<Output<P> | undefined> {
    const id = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error(`Message timeout: ${path}`))
      }, timeout) as unknown as number

      pendingRequests.set(id, {
        timeoutId,
        resolve: (data: any) => {
          clearTimeout(timeoutId)
          resolve(data)
        },
        reject: (error: any) => {
          clearTimeout(timeoutId)
          reject(error)
        },
      })
      port.postMessage({ id, path, payload })
    })
  }

  // add listeners
  port.onMessage.addListener(onMessage)
  port.onDisconnect.addListener(onDisconnect)

  // return
  return {
    sendMessage,
    get connected () { return connected },
    get port () { return port },
    close,
  }
}

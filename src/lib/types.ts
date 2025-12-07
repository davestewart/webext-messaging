// ---------------------------------------------------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------------------------------------------------

export type Logger = {
  log: (...args: any[]) => void
  info: (...args: any[]) => void
  error: (...args: any[]) => void
}

// ---------------------------------------------------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Route handler function type
 */
export type MessageHandler<Payload = any, Value = any> = (payload: Payload, sender?: chrome.runtime.MessageSender) => Value | Promise<Value>

/**
 * Hash of route => handler pairs
 */
export interface RouteRecords {
  [key: string]: MessageHandler
}

// ---------------------------------------------------------------------------------------------------------------------
// request / response
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Request for one-time messages
 */
export interface MessageRequest<T = any> {
  path: string
  payload?: T
}

/**
 * Response for one-time messages
 */
export interface MessageResponse<T = any> {
  data?: T
  error?: any
}

/**
 * Request for port messages
 */
export interface PortRequest<T = any> {
  id: string
  path: string
  payload?: T
}

/**
 * Response for port messages
 */
export interface PortResponse<T = any> {
  id: string
  data?: T
  error?: any
}

// ---------------------------------------------------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------------------------------------------------

export type MessageErrorType =
  | 'no_response'
  | 'no_handler'
  | 'handler_error'

export interface MessageErrorInfo {
  path?: string
  payload?: any
  sender?: chrome.runtime.MessageSender
  originalError?: any
}

export interface MessageError {
  type: MessageErrorType
  info?: MessageErrorInfo
  message?: string
}

// ---------------------------------------------------------------------------------------------------------------------
// router options
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Base options for message routers
 */
export interface BaseRouterOptions {
  /**
   * An optional group name for the router (used when generating senders)
   */
  group?: string

  /**
   * Logger instance to use for logging
   */
  logger?: Logger

  /**
   * Whether the router is enabled initially (default: true)
   */
  enabled?: boolean
}

/**
 * Options for the (one-time) message router
 */
export interface RouterOptions extends BaseRouterOptions {
  /**
   * Whether to proxy messages that don't have a handler to another extension/context
   *
   * - `true`: Proxy all messages without a handler
   * - `string[]`: Array of path patterns to proxy (e.g., `['sidepanel:*', 'content:windows/*', 'api/auth/*']`)
   */
  proxy?: boolean | string[]
}

/**
 * Options for the (long-lived) port message router
 */
export interface PortRouterOptions extends BaseRouterOptions {
  /**
   * The channel name of the port connection
   */
  channel?: string

  /**
   * The tab ID (number) or extension ID (string) to connect to
   */
  targetId?: number | string

  /**
   * Whether to include the TLS Channel ID in the connection (Firefox only)
   */
  includeTlsChannelId?: boolean
}

// ---------------------------------------------------------------------------------------------------------------------
// sender options
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Options for the messenger
 */
export interface MessageSenderOptions {
  /**
   * Logger instance to use for logging
   */
  logger?: Logger

  /**
   * Error callback for message sending errors
   *
   * @param error
   */
  onError?: (error: any) => void

  /**
   * Optional default tab ID (number) or extension ID (string) to send messages to
   */
  targetId?: number | string
}

/**
 * Options for the port messenger
 */
export interface PortSenderOptions extends MessageSenderOptions {
  /**
   * The channel name of the port connection to send messages to
   */
  channel?: string

  /**
   * Milliseconds to wait for a response before timing out (default: 30000)
   */
  timeout?: number
}

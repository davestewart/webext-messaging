import {
  Logger,
  MessageRequest,
  MessageResponse,
  MessageSenderOptions,
  PortRequest,
  PortResponse,
  MessageHandler,
  MessageError,
  MessageErrorType,
} from './types'

// ---------------------------------------------------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------------------------------------------------

export let lastError: MessageError | undefined

export function setMessageError (type?: MessageErrorType, message?: string, info?: Record<string, any>): MessageError | undefined {
  lastError = type
    ? { type, message, info }
    : undefined
  return lastError
}

export function getMessageError (): MessageError | undefined {
  return lastError
}

// ---------------------------------------------------------------------------------------------------------------------
// messaging
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Send a raw message request { path, payload } using chrome.runtime.sendMessage / chrome.tabs.sendMessage
 *
 * @param message
 * @param target
 * @param options
 */
export async function sendMessageRequest<T extends any> (message: MessageRequest, target?: number | string, options?: MessageSenderOptions): Promise<T | undefined> {
  setMessageError()
  const response: Promise<MessageResponse> = typeof target === 'number'
    ? chrome.tabs.sendMessage(target, message) // specific tab
    : typeof target === 'string'
      ? chrome.runtime.sendMessage(target, message) // specific extension by id
      : chrome.runtime.sendMessage(message) // current extension
  return handleMessageResponse<T>(response, options)
}

/**
 * Handle a raw message response { data, error } from chrome.runtime.sendMessage / chrome.tabs.sendMessage
 *
 * @param response
 * @param options
 */
export async function handleMessageResponse<T extends any> (response: Promise<MessageResponse<T>>, options?: MessageSenderOptions): Promise<T | undefined> {
  return response
    .then((result) => {
      if (result.error) {
        throw result.error
      }
      return result.data
    })
    .catch((error: unknown) => {
      options?.logger?.error('Error sending message:', error)
      options?.onError?.(error)
      return undefined
    })
}

/**
 * Internal function to execute route handler and send response
 *
 * @param handler       Handler function to execute, i.e. `(payload, sender) => data`
 * @param request       Request object, i.e. `{ id, path, payload }`
 * @param sendResponse  Function to send the response, i.e. `(response) => void`
 * @param sender        Optional sender information, i.e. `{ tab, id, url }`
 * @param logger        Optional logger instance for error logging, i.e. `console`
 */
export function executeMessageHandler <
  Handler extends MessageHandler = any,
  Input = Handler extends MessageHandler<infer I, any>
    ? I
    : any,
  Request extends MessageRequest<Input> | PortRequest<Input> = any,
  Output = Handler extends MessageHandler<any, infer O>
    ? O
    : any,
  Response = Request extends PortRequest
    ? PortResponse<Output>
    : MessageResponse<Output>,
>(
  handler: Handler,
  request: Request,
  sendResponse: (response?: Response) => void,
  sender?: chrome.runtime.MessageSender,
  logger?: Logger,
) {
  const { path, payload } = request
  const id = 'id' in request ? request.id : undefined

  try {
    const data = handler(payload, sender)
    if (data instanceof Promise) {
      data.then(data => {
        const response = id ? { id, data } : { data }
        sendResponse(response as Response)
      })
      return true
    }
    const response = id ? { id, data } : { data }
    sendResponse(response as Response)
  }
  catch (error) {
    logger?.error('Error in message handler:', { error, path, payload, sender })
    const response = id ? { id, error } : { error }
    sendResponse(response as Response)
  }
}

import { createMessageSender } from './main'

export {
  sendMessageRequest,
  handleMessageResponse,
  executeMessageHandler,
  getMessageError,
} from './core'

export {
  defineMessageRoutes,
  createMessageRouter,
  createMessageSender,
  createPortRouter,
  createPortSender,
} from './main'

export const {
  sendMessage,
  sendMessageTo
} = createMessageSender()

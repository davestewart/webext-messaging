import {
  createMessageRouter,
  createMessageSender,
  defineMessageRoutes,
  executeMessageHandler
} from '../src/lib'

type Role = 'admin' | 'user'

const routes = defineMessageRoutes({
  'foo': () => 'It works!',
  'foo/bar': async ({ value }: { value: number }) => {
    return value * 2
  },
})

const router = createMessageRouter({
  'foo': () => 'This works too!',
  'foo/bar': async ({ value }: { value: number }) => {
    return value * 2
  },
  'foo/bar/baz': async ({ name }: { name: string }) => {
    return { name, age: 20, role: <Role>'admin' }
  },
})

// export type only!
type Routes = typeof router.routes

// use type in other process
const { sendMessage } = createMessageSender<Routes>()

// send message
const result = await sendMessage('foo/bar/baz', { name: 'Bill' })

executeMessageHandler(({ id }: { id: string }) => new Date(id), { path: '', payload: { id: 'test' } }, (value) => {
  console.log(value?.data?.getDate()) //?
})


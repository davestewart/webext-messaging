import { addAlias, defineWxtModule } from 'wxt/modules'
import messageRouterPlugin, { useBuilder } from '../vite'
import 'wxt'

export interface MessageRouterModuleOptions {
  include?: string[];
  alias?: string;
}

declare module 'wxt' {
  export interface InlineConfig {
    messaging?: MessageRouterModuleOptions;
  }
}

export default defineWxtModule<MessageRouterModuleOptions>({
  configKey: 'messaging',

  setup (wxt, options) {
    // const declarationFile = resolve(wxt.config.wxtDir, 'wxt-module-message-router.d.ts')
    const builder = useBuilder({
      moduleName: options?.alias
    })

    // add simple alias
    // addAlias(wxt, alias, 'vite-message-router')

    // set up the plugin
    const plugin = messageRouterPlugin({
      builder,
    })

    wxt.hook('vite:build:extendConfig', (_entrypoints, config) => {
      config.plugins ||= []
      config.plugins.push(plugin)
    })

    wxt.hook('vite:devServer:extendConfig', (config) => {
      config.plugins ||= []
      config.plugins.push(plugin)
    })

    wxt.hook('server:created', (_, server) => {
      builder.configureServer(server)
    })

    wxt.hook('prepare:types', async (_, entries) => {
      builder.init()
      const text = builder.update()

      entries.push({
        tsReference: true,
        path: 'vite-message-router.d.ts',
        text,
      })
    })
  },

/*  _setup (wxt, options?: MessageRouterModuleOptions) {
    // settings
    const declarationFile = resolve(wxt.config.wxtDir, 'wxt-module-message-router.d.ts')

    // options
    const {
      include = options?.include ?? ['**!/!*.ts'],
      alias = options?.alias ?? '#messaging',
    } = options ?? {}

    // add alias for #messaging imports
    // addAlias(wxt, '#messaging', outputFilePath)

    // create plugin
    const builder = useBuilder({
      include,
      declarationFile,
    })

    // configure hot-reload
    wxt.hook('server:created', (_, server) => {
      builder.init()
      const { testFile } = builder
      server.watcher
        .on('add', file => testFile(file, 'add'))
        .on('change', file => testFile(file, 'change'))
        .on('unlink', file => testFile(file, 'unlink'))
    })

    // build types
    wxt.hook('prepare:types', async (name, config) => {
      builder.update()
    })
  },*/
})

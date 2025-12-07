import { Plugin } from 'vite'
import { useBuilder } from './ast/builder'

export {
  useBuilder,
}

export interface MessageRouterPluginOptions {
  /**
   * Glob patterns for files to scan for route definitions
   * @default ['src/**\/*.{ts,tsx}']
   */
  include?: string[]

  /**
   * Optional external builder
   *
   * Disables internal file watching and server integration.
   * Used for plugin wrappers that want to manage the builder lifecycle themselves
   */
  builder?: ReturnType<typeof useBuilder>

  /**
   * File path for generated file
   * @default '.vite/messaging.ts'
   */
  declarationFile?: string

  /**
   * Module name / virtual module alias
   * @default 'vite-message-router'
   */
  moduleName?: string

  /**
   * Path to tsconfig.json
   * @default 'tsconfig.json'
   */
  tsconfig?: string
}

export default function messageRouterPlugin (options: MessageRouterPluginOptions = {}) {
  // options
  const {
    builder,
    moduleName = 'vite-message-router',
  } = options

  // builder
  const _builder = builder || useBuilder({ ...options, moduleName })

  // module
  const MODULE_NAME = moduleName
  const MODULE_ID = '\0' + MODULE_NAME

  // plugin
  return {
    name: MODULE_NAME,

    buildStart () {
      if (!builder) {
        _builder.init()
        _builder.update()
      }
    },

    configureServer (server: any) {
      if (!builder) {
        _builder.configureServer(server)
      }

      _builder.onInvalidate(() => {
        const module = server.moduleGraph.getModuleById(MODULE_ID)
        if (module) {
          server.moduleGraph.invalidateModule(module)
          server.reloadModule(module)
        }
      })
    },

    resolveId (id: string) {
      if (id === MODULE_NAME) {
        return MODULE_ID
      }
    },

    load (id: string) {
      if (id === MODULE_ID) {
        return _builder.getVirtualModuleContent()
      }
    },
  }
}

export function old (options: MessageRouterPluginOptions = {}): Plugin {
  const {
    moduleName = 'vite-message-router',
  } = options


  const builder = useBuilder(options)

  return {
    name: 'webext-message-routes',

    configResolved(config) {
      console.log('\n\nCONFIG RESOLVED', config.root)
      builder.init(config.root)
    },

    buildStart() {
      console.log('\n\nBUILD START')
      builder.update()
    },

    handleHotUpdate({ file }) {
      builder.testFile(file, 'change')
    },

    configureServer(server) {
      const { testFile } = builder
      server.watcher
        .on('add', file => testFile(file, 'add'))
        .on('change', file => testFile(file, 'change'))
        .on('unlink', file => testFile(file, 'unlink'))
    },
  }
}

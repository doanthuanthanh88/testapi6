import { Tag } from '@/components/Tag'
import { Testcase } from '@/components/Testcase'
import chalk from 'chalk'
import { join } from 'path'
import { context } from '../Context'
import { ContentScript } from './Script'

/**
 * Load external modules or javascript code
 * 
 * Search modules (branches) at : https://github.com/doanthuanthanh88/testapi6-modules
 * 
 * ```yaml
 * - Require:
 *     root: /home/user
 *     modules: 
 *       - ./my-librarry/dist/index.js
 *       - /home/user/my-librarry/dist/index.js
 *     code: |
 *       Vars.url = http://test_url_here
 *       Validate.globalCheck = () => true
 * ```
 */
export class Require extends Tag {
  preload = true
  /**
   * Root path where modules are installed
   * - npm: It auto load in npm global packages, prefix and binaries
   * - yarn: It auto load in yarn global packages, prefix and binaries
   * - "": It combine npm and yarn
   * - /PATH_TO_MODULE: It auto load from this path
   */
  root: string
  /** External modules */
  modules: string[]
  /** 
   * Javascript code
   * ```yaml
   * Embed variables:
   *   - Vars: Global variable
   *   - Validate: Global validators
   *   - ExternalLibraries: External module library
   *   - Utils: Global utility functions
   *   - Context: Global context
   *   - $: this
   *   - $$: parent which wrap this tag 
   * ```
   * */
  code: ContentScript

  init(attrs: any, ...props: any[]) {
    if (Array.isArray(attrs)) {
      attrs = {
        modules: attrs
      }
    }
    return super.init(attrs, ...props)
  }

  static getLibPaths(root?: string) {
    const libPaths = []
    const { npm, yarn } = require('global-dirs')
    if (root && root !== 'yarn' && root !== 'npm') {
      libPaths.push(Testcase.getPathFromRoot(root))
    }
    libPaths.push('')
    if (!root || root === 'yarn') {
      libPaths.push(
        Testcase.getPathFromRoot(yarn.packages),
        Testcase.getPathFromRoot(yarn.prefix),
        Testcase.getPathFromRoot(yarn.binaries),
      )
    }
    if (!root || root === 'npm') {
      libPaths.push(
        Testcase.getPathFromRoot(npm.packages),
        Testcase.getPathFromRoot(npm.prefix),
        Testcase.getPathFromRoot(npm.binaries),
      )
    }
    return libPaths
  }

  static getPathGlobalModule(name: string, root?: string) {
    const libPaths = Require.getLibPaths(root)
    let modulePath = undefined
    for (const i in libPaths) {
      modulePath = join(libPaths[i], name)
      try {
        require.resolve(modulePath)
        return modulePath
      } catch { }
    }
    throw new Error(`Please install module "${name}" \n    \`npm install -g ${name}\` \n OR \n    \`yarn global add ${name}\``)
  }

  async exec() {
    if (this.modules) {
      context.group('Installed external modules')
      this.modules.forEach((p: string) => {
        let obj: any
        let modulePath = 'System'
        try {
          modulePath = Require.getPathGlobalModule(p, this.root)
          obj = require(modulePath)
          for (let k in obj) {
            context.ExternalLibraries[k] = obj[k]
            context.log('- %s (%s)', k, modulePath)
          }
        } catch (err) {
          context.error(chalk.red(err.message))
          throw err
        }
      })
      context.groupEnd()
    }

    if (this.code) {
      // @ts-ignore
      const $ = this
      // @ts-ignore
      const $$ = this.$$
      // @ts-ignore
      const { Vars, Validate, ExternalLibraries, Utils } = context
      // @ts-ignore
      const Context = context
      await eval(this.code)
    }
  }
}

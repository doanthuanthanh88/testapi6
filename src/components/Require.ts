import { Tag } from '@/components/Tag'
import { Testcase } from '@/components/Testcase'
import { ContentScript } from './Script'
import { context } from '../Context'
import chalk from 'chalk'
import { join } from 'path'
import { npm, yarn } from 'global-dirs'

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

  constructor(attrs: Require) {
    super(attrs)
  }

  async exec() {
    if (this.modules) {
      context.group('Installed external libraries')
      this.modules.forEach((p: string) => {
        let obj: any
        let modulePath = 'System'
        try {
          obj = require(p)
        } catch (err) {
          const libPaths = []
          if (!this.root || this.root === 'yarn') {
            libPaths.push(yarn.packages, yarn.prefix, yarn.binaries)
          }
          if (!this.root || this.root === 'npm') {
            libPaths.push(npm.packages, npm.prefix, npm.binaries)
          }
          if (libPaths.length === 0) {
            libPaths.push(this.root || '')
          }
          for (const i in libPaths) {
            modulePath = Testcase.getPathFromRoot(`${join(libPaths[i], p)}`)
            try {
              obj = require(modulePath)
              break
            } catch (err) {
              if (+i === libPaths.length - 1) {
                context.error(chalk.red(`Could not install external library %s`), p)
                throw err
              }
            }
          }
        }
        for (let k in obj) {
          context.ExternalLibraries[k] = obj[k]
          context.log('- %s (%s)', k, modulePath)
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
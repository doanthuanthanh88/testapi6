import { Tag } from '@/components/Tag'
import { Testcase } from '@/components/Testcase'
import { ContentScript } from './Script'
import { context } from '../Context'
import chalk from 'chalk'
import { join } from 'path'

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
  /** Root path where modules are installed */
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
          try {
            modulePath = Testcase.getPathFromRoot(`${join(this.root || '', p)}`)
            obj = require(modulePath)
          } catch (err) {
            context.error(chalk.red(`Could not install external library %s`), p)
            throw err
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
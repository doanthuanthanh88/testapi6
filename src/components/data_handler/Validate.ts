import { Tag } from "../Tag";
import chalk from 'chalk'
import chai from 'chai'
import { context } from '../../Context'

/**
 * Validate data (system, chaijs, user customize, user customize base on chaijs)
 * 
 * Some validators which system provided:
 * - schema: Validate object schema
 * - length: Validate length of array or string
 * - match: Validate object must be match target
 * - in: Validate object must be in targets
 * 
 * ```yaml
 * - Vars:
 *     obj: [1,2,3,4]
 * 
 * - Validate:
 *     title: Validate object schema which use builtin system
 *     func: schema
 *     args: 
 *       - ${obj}
 *       - { "type": "array" }
 * ```
 */
export class Validate extends Tag {
  /** Validator name */
  func: string
  /** Validator arguments */
  args: any[]

  async exec() {
    try {
      if (this.func.includes('?')) {
        let func = this.func as string
        var i = 0
        const rd = Math.random().toString()
        func = func.split('\\?').join(rd).replace(/(\?)/g, () => `arrs[${i++}]`).split(rd).join('\\?')
        // @ts-ignore
        const { expect, assert } = chai
        // @ts-ignore
        const arrs = this.args
        let t
        eval(`t = ${func}`)
        if (typeof t === 'function') {
          eval(`t = t(...args)`)
        }
        eval(func)
        await t
      } else {
        this.func = context.Validate[this.func] || this.func
        if (typeof this.func === 'string') {
          const [chaiFunc] = this.func.split('.', 1)
          if (chaiFunc === 'expect') {
            // @ts-ignore
            const [obj, ...args] = this.args
            // @ts-ignore
            const expect = chai.expect(obj)
            let t
            eval(`t = ${this.func}`)
            if (typeof t === 'function') {
              eval(`t = t(...args)`)
            }
            await t
          } else if (chaiFunc === 'assert') {
            // @ts-ignore
            const { assert } = chai
            // @ts-ignore
            const args = this.args
            let t
            eval(`t = ${this.func}`)
            if (typeof t === 'function') {
              eval(`t = t(...args)`)
            }
            await t
          } else {
            let func
            eval(`func = ${this.func}`) as any
            await func(...this.args)
          }
        } else if (typeof this.func === 'function') {
          const func = this.func as any
          await func(...this.args)
        } else {
          throw new Error(`Could not found validate "${this.func}"`)
        }
      }
    } catch (err) {
      this.error = err
    } finally {
      if (!this.error) {
        if (!this.slient) {
          context.log('  %s\t%s', chalk.green('✔️'), chalk.magenta(this.title))
        }
      } else {
        context.group('  %s\t%s: %s', chalk.red('✘'), chalk.magenta(this.title.split(' ').join('-')), this.error.message || '')
        if (this.error.actual || this.error.expected) {
          context.print('')
          context.print(`${chalk.red('‣ %s')}`, 'Actual')
          context.print('')
          context.print(`${chalk.red.italic('%s')}`, this.error.actual)
          context.print('')
          context.print(`${chalk.green('‣ %s')}`, 'Expected')
          context.print('')
          context.print(`${chalk.green.italic('%s')}`, this.error.expected)
          context.print('')
        }
        context.groupEnd()
      }
    }
    return this.error
  }
}
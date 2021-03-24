import { Tag } from "../Tag";
import chalk from 'chalk'
import chai from 'chai'
import {context} from '../../Context'

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
      const [chaiFunc] = this.func.split('.', 1)
      if (chaiFunc === 'expect') {
        // @ts-ignore
        const [obj, ...args] = this.args
        // @ts-ignore
        const expect = chai.expect(obj) 
        let t
        eval(`t = ${this.func}(...args)`)
        await t
      } else if (chaiFunc === 'assert') {
        // @ts-ignore
        const assert = chai.assert
        // @ts-ignore
        const args = this.args
        let t
        eval(`t = ${this.func}(...args)`)
        await t
      } else {
        const func = context.Validate[this.func]
        if (!func) throw new Error(`Could not found validate "${this.func}"`)
        await func(...this.args)
      }
    } catch (err) {
      this.error = err
    } finally {
      if (!this.error) {
        if (!this.slient) {
          context.log('- %s %s', chalk.green('✔️'), chalk.magenta(this.title))
        }
      } else {
        context.group('- %s %s: %s', chalk.red('❌'), chalk.bgRed(this.title), chalk.red.italic(this.error.message || ''))
        if (this.error.actual || this.error.expected) {
          context.error('  + %s', chalk.red('actual'), this.error.actual)
          context.error('  + %s', chalk.green('expected'), this.error.expected)
        }
        context.groupEnd()
      }
    }
    return this.error
  }
}
import { cloneDeep } from "lodash"
import { Import, Tag } from "./Tag"
import { Testcase } from "./Testcase"
import { context } from "../Context"
import chalk from "chalk"

context
  .on('log:group:begin', (e: Group) => {
    if (e.title) context.group(chalk.blue(e.icon + ' ' + e.title), ':', chalk.italic(e.description || ''))
  })
  .on('log:group:end', (e: Group) => {
    if (e.title) context.groupEnd()
  })

/**
 * Group some tags
 * 
 * ```yaml
 * - Group:
 *     title: Test print
 *     vars:
 *       user: Foo
 *     steps:
 *       - Echo: Hello ${user}
 *       - Sleep: 1000
 *       - Echo: Wake up after 1s
 * ```
 */
export class Group extends Tag {
  /** Description */
  description: string
  /** Steps which will run in the group */
  steps: Tag[]
  /** Declare to extends later */
  templates: any[]
  /** Expose a tag */
  '->': string
  /** Extends from a expose tag */
  '<-': string[]

  /** Condition to loop */
  loop: string | boolean
  /** Key in the loop */
  loopKey: string | number
  /** Value in the loop */
  loopValue: any

  _shadow: this
  _isStop: boolean

  constructor(attrs) {
    super(attrs)
  }

  stop() {
    this._isStop = true
  }

  async setup(tc: Testcase) {
    this.tc = tc
    await Import(this.templates, tc)
    this.steps = await Import(this.steps, tc) || []
    if (this.loop) this._shadow = cloneDeep(this)
    if (!this.testIt) {
      const someSteps = this.steps.filter(e => e.testIt)
      this.testIt = !!someSteps.length
      if (this.testIt) {
        this.steps = someSteps
      }
    }
    if (!this.tc.isTestSome) this.tc.isTestSome = this.testIt
    if (!this.icon) this.icon = '⊢'
    return this
  }

  prepare(scope?: any) {
    return super.prepare(scope, ['loop', 'loopKey', 'loopValue'])
  }

  async exec() {
    if (!this.disabled) {
      // Listen to force stop
      context.once('app:stop', async () => {
        await this.stop()
      })
      if (this.loop) {
        let arrs = this.replaceVars(this.loop, { ...context.Vars, Vars: context.Vars, $: this, $$: this.$$, Utils: context.Utils, Result: context.Result }, ['steps'])
        if (this.async) {
          if (typeof arrs === 'object') {
            const proms = []
            for (let k in arrs) {
              if (this._isStop) return
              const step = cloneDeep(this._shadow) as Group
              step.tc = this.tc
              step.loopKey = k
              step.loopValue = arrs[k]
              proms.push((async (step) => {
                await step.prepare()
                await step.each()
              })(step))
            }
            if (proms.length > 0) {
              await Promise.all(proms)
            }
          } else {
            throw new Error('Not supported async without object or array')
          }
        } else {
          if (typeof arrs === 'boolean') {
            let i = 0
            while (arrs) {
              if (this._isStop) return
              const step = cloneDeep(this._shadow) as Group
              step.tc = this.tc
              step.loopKey = i
              step.loopValue = arrs
              await step.prepare()
              await step.each()
              arrs = this.replaceVars(this.loop, { ...context.Vars, Vars: context.Vars, $: this, $$: this.$$, Utils: context.Utils, Result: context.Result }, ['steps'])
            }
          } else {
            for (let k in arrs) {
              if (this._isStop) return
              const step = cloneDeep(this._shadow) as Group
              step.tc = this.tc
              step.loopKey = k
              step.loopValue = arrs[k]
              await step.prepare()
              await step.each()
            }
          }
        }
      } else {
        await this.each()
      }
    }
  }

  async _each(step: Tag) {
    await step.prepare()
    if (!step.disabled) {
      try {
        await step.beforeExec()
        await step.exec()
        if (step.error) {
          if (step.ignoreError) return
          if (typeof step.ignoreError !== 'boolean') {
            if (this.ignoreError) return
            if (typeof this.ignoreError !== 'boolean') {
              if (this.tc.ignoreError) return
            }
          }
          throw step.error
        }
      } finally {
        await step.dispose()
      }
    }
  }

  async each() {
    context.emit('log:group:begin', this)
    const proms = []
    const self = this
    for (let i in this.steps) {
      if (this._isStop) return
      const step = this.steps[i]
      step.$$ = this
      step.tc = this.tc
      if (step.async) {
        proms.push(step)
      } else if (proms.length > 0) {
        await Promise.all(proms.map(step => self._each(step)))
        proms.splice(0, proms.length)
        await self._each(step)
      } else {
        await self._each(step)
      }
    }
    if (proms.length > 0) {
      await Promise.all(proms.map(step => self._each(step)))
    }
    context.emit('log:group:end', this)
  }
}
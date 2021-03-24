import * as _ from 'lodash'
import { Tag } from "../Tag";
import prompts from 'prompts'
import { context } from '@/Context';

/**
 * Get user input
 * 
 * ```yaml
 * - Input: 
 *     title: User input
 *     var: userInput
 *
 * - Echo: ${userInput}
 * ```
 */
export class Input extends Tag {
  // Refer: https://www.npmjs.com/package/prompts#invisiblemessage-initial
  /** Force user must enter something */
  required: boolean
  /** Validate user input with the pattern */
  pattern: string
  /** Set user input data to this */
  var: string

  _prmpt: any
  /** User input type */
  type: 'text' | 'password' | 'invisible' | 'number' | 'confirm' | 'list' | 'toggle' | 'select' | 'multiselect' | 'autocompleteMultiselect' | 'autocomplete' | 'date'
  /** Allow user pick some in the list which we expected */
  choices?: { title: string, value: any }[]

  constructor(attrs) {
    super(attrs)
  }

  stop() {
    if (this._prmpt) {
      this._prmpt.aborted = true
      this._prmpt.close()
    }
  }

  async question() {
    const self = this
    const opts = {
      type: 'text',
      ...self,
      message: self.title || '',
      name: 'value',
    }
    this._prmpt = await prompts(opts);
    return this._prmpt?.value
  }

  async exec() {
    // Listen to force stop
    context.once('app:stop', async () => {
      await this.stop()
    })

    // if (this.title) context.emit('log:input', this)
    let txt = await this.question() as string
    const pt = this.pattern && new RegExp(this.pattern)
    while ((this.required && !txt) || (pt?.test(txt))) {
      txt = await this.question() as string
    }
    if (this.var) context.Vars[this.var] = txt
    return txt
  }
}

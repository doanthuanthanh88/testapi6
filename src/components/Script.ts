import { context } from "@/Context";
import { Tag } from "./Tag";

/** Javascript code to do something */
export type ContentScript = string

/** 
 * Embed javascript inline code 
 * 
 * Some embed variables:
 *   - Vars: Global variable
 *   - Validate: Global validators
 *   - Utils: Global utility functions
 *   - Context: Global context (log, event...)
 *   - $: this
 *   - $$: parent which wrap this tag 
 * 
 * ```yaml
 * - Vars:
 *     arr: [1,2,3,4]
 * 
 * - Script: |
 *     Context.log('Do something here')
 *     Vars.arr = Vars.arr.filter(e => e > 3)
 * 
 * - Echo: ${arr}
 * ```
 * */
export class Script extends Tag {
  content: ContentScript

  init(attrs: any) {
    super.init(attrs, 'content')
  }

  prepare(scope: any) {
    super.prepare(scope, ['content'])
  }

  async exec() {
    // @ts-ignore
    const $ = this
    // @ts-ignore
    const $$ = this.$$
    // @ts-ignore
    const { Vars, Validate, Utils } = context
    // @ts-ignore
    const Context = context
    // @ts-ignore
    const _ = Utils.lodash
    await eval(this.content)
  }
}
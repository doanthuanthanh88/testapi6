import { context } from "@/Context";
import { omit } from 'lodash';
import { Tag } from "./Tag";

/**
 * Create new global variables
 * 
 * ```yaml
 * - Vars:
 *     user1: foo
 *     user2: bar
 * 
 * - Echo: Hello ${user1}, ${user2}
 * ```
 */
export class Vars extends Tag {
  [key: string]: any

  constructor(attrs) {
    super(attrs)
  }

  prepare() {
    for (let k in omit(this, ['$$', 'tc', 'context'])) {
      context.Vars[k] = this.replaceVars(this[k], { ...context.Vars, Vars: context.Vars, $: this, $$: this.$$, Utils: context.Utils, Result: context.Result })
    }
  }

  exec() {
    // Tag.replaceVars(this)
  }
}
import { context } from "@/Context";
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
  private _ignoreProps = new Set(['$$', 'tc', 'context'])

  prepare() {
    const varContext = this.getReplaceVarsContext()
    for (let k in this) {
      if (this._ignoreProps.has(k)) continue
      varContext[k] = context.Vars[k] = this.replaceVars(this[k], varContext)
    }
  }

  exec() {
    // Tag.replaceVars(this)
  }
}
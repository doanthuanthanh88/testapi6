import { context } from "@/Context";
import { Tag } from "../Tag";

/**
 * Parse data base on regex pattern
 * 
 * ```yaml
 * - Regex: 
 *     title: Extract title content
 *     input: <title>test</title>
 *     actions: match # match | exec | test
 *     pattern: /<title>(.*?)<\/title>/
 *     var: result
 * 
 * - Echo: ${result}
 * ```
 */
export class Regex extends Tag {
  /** Regex pattern */
  pattern: string
  /** Regex method to execute */
  action: 'match' | 'exec' | 'test'
  /** Data string input */
  input: string
  /** Set data after regex executed done */
  var: string | object
  /** Raw value */
  value: any

  exec() {
    if (this.title) context.log(`- %s`, this.title)
    const pt = eval(this.pattern) as RegExp
    switch (this.action) {
      case 'exec':
        this.value = []
        let m: string[]
        while ((m = pt.exec(this.input)) !== null) {
          this.value.push(m)
        }
        break
      case 'test':
        this.value = pt.test(this.input)
      default:
        this.value = this.input?.match(pt)
        break
    }
    if (this.var) this.setVar(this.var, this.value)
  }
}
import { context } from "@/Context";
import chalk from "chalk";
import { toJsonSchema } from "../doc/DocUtils";
import { Tag } from "../Tag";

/**
 * Print schema of data
 * 
 * ```yaml
 * - Vars:
 *     obj: {
 *       name: "test",
 *       age: 123
 *     }
 * 
 * - Schema: ${obj}
 * ```
 */
export class Schema extends Tag {
  msg: any

  init(attrs: any) {
    super.init(attrs, 'msg')
  }

  async exec() {
    if (this.msg !== null && this.msg !== undefined) {
      this.msg = toJsonSchema(this.msg, false)
    }
    context.log(chalk.yellow('%j'), this.msg)
  }
}
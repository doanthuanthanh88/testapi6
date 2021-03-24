import { toJsonSchema } from "../doc/DocUtils";
import { Tag } from "../Tag";
import chalk from "chalk";
import { context } from "@/Context";

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

  constructor(attrs) {
    super(attrs, 'msg')
  }

  async exec() {
    if (this.msg !== null && this.msg !== undefined) {
      this.msg = toJsonSchema(this.msg)
    }
    context.log(chalk.yellow('%j'), this.msg)
  }
}
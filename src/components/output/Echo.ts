import { Tag } from "../Tag";
import chalk from "chalk";
import { context } from "@/Context";

/**
 * Print to screen
 * 
 * ```yaml
 * - Echo: Hello world
 * - Echo: Inspect ${obj}
 * - Echo:
 *     title: Debug object
 *     msg: ${obj}
 * ```
 */
export class Echo extends Tag {
  /** Message or data */
  msg: any

  constructor(attrs: string | Echo) {
    super(attrs, 'msg')
  }

  async exec() {
    if (typeof this.msg === 'string') {
      context.print(chalk.yellow('%s'), this.msg)
    } else {
      context.log(chalk.yellow('%j'), this.msg)
    }
  }
}
import { context } from "@/Context";
import chalk from "chalk";
import { merge } from "lodash";
import { Tag } from "../Tag";

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
  color: 'reset' | 'bold' | 'dim' | 'italic' | 'underline' | 'inverse' | 'hidden' | 'strikethrough' | 'visible' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' | 'grey' | 'blackBright' | 'redBright' | 'greenBright' | 'yellowBright' | 'blueBright' | 'magentaBright' | 'cyanBright' | 'whiteBright' | 'bgBlack' | 'bgRed' | 'bgGreen' | 'bgYellow' | 'bgBlue' | 'bgMagenta' | 'bgCyan' | 'bgWhite' | 'bgBlackBright' | 'bgRedBright' | 'bgGreenBright' | 'bgYellowBright' | 'bgBlueBright' | 'bgMagentaBright' | 'bgCyanBright' | 'bgWhiteBright'

  init(attrs: any) {
    super.init(attrs, 'msg')
    merge(this, merge({ color: 'yellow' }, this))
  }

  async exec() {
    if (typeof this.msg === 'string') {
      context.print(chalk[this.color]('%s'), this.msg)
    } else {
      context.log(chalk[this.color]('%j'), this.msg)
    }
  }
}
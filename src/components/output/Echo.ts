import { Tag } from "../Tag";
import chalk from "chalk";
import { context } from "@/Context";
import { merge } from "lodash";

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

  constructor(attrs: string | Echo) {
    super(merge({ color: 'yellow' }, attrs), 'msg')
  }

  async exec() {
    if (typeof this.msg === 'string') {
      context.print(chalk[this.color]('%s'), this.msg)
    } else {
      context.log(chalk[this.color]('%j'), this.msg)
    }
  }
}
import { context } from "@/Context";
import chalk from "chalk";
import { Group } from "../Group";
import { Input } from "../input/Input";

/**
 * Print to screen
 * 
 * ```yaml
 * - Menu: Hello world
 * - Menu: Inspect ${obj}
 * - Menu:
 *     title: Debug object
 *     msg: ${obj}
 * ```
 */
export class Menu extends Group {

  private varName: string
  private input: Input
  select: 'one' | 'many'

  constructor() {
    super()
    this.varName = `menu${Date.now()}`
    this.input = new Input()
  }

  init(attrs: any) {
    this.input.init({
      title: attrs.description,
      type: attrs.select === 'many' ? 'multiselect' : 'select',
      choices: attrs.items.map((item, i) => {
        const [tagName,] = Object.keys(item)
        return {
          title: item[tagName].title,
          value: +i
        }
      }),
      var: this.varName
    })
    attrs.title = `⑆ ${attrs.title}`
    attrs.steps = attrs.items
    attrs.steps.forEach((item, i) => {
      const [tagName,] = Object.keys(item)
      if (attrs.select === 'many') {
        item[tagName].disabled = `\${!${this.varName}.includes(${i})}`
      } else {
        item[tagName].disabled = `\${${this.varName} !== ${i}}`
      }
    })
    delete attrs.items
    super.init(attrs)
  }

  async prepare(scope?: any) {
    context.log(chalk.cyan.bold(`${this.title}`))
    await this.input.prepare(scope)
    await super.prepare(scope)
  }

  async exec() {
    await this.input.exec()
    context.log('', '')
    await super.exec()
  }
}
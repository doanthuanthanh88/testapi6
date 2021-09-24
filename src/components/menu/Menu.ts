import { context } from "@/Context";
import chalk from "chalk";
import { Group } from "../Group";

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
  select: 'one' | 'many'

  constructor() {
    super()
    this.varName = `menu${Date.now()}`
    context.Vars[this.varName] = true
  }

  init(attrs: any) {
    attrs.title = `⑆ ${attrs.title}`
    attrs.steps = [
      {
        Input: {
          title: attrs.description,
          type: attrs.select === 'many' ? 'multiselect' : 'select',
          choices: attrs.items.map((item, i) => {
            const [tagName,] = Object.keys(item)
            return {
              title: item[tagName].title,
              value: +i + 1
            }
          }),
          var: this.varName
        }
      },
      ...attrs.items.map((item, i) => {
        const [tagName,] = Object.keys(item)
        if (attrs.select === 'many') {
          item[tagName].disabled = `\${!${this.varName}.includes(${+i + 1})}`
        } else {
          item[tagName].disabled = `\${${this.varName} !== ${+i + 1}}`
        }
        return item
      })
    ]
    delete attrs.items
    super.init(attrs)
  }

  get value() {
    return context.Vars[this.varName]
  }

  async exec() {
    context.log(chalk.cyan.bold(`${this.title}`))
    context.log('', '')
    await super.exec()
  }
}
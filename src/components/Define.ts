import { Tag } from "./Tag";
import { context } from "../Context"

export class Define extends Tag {
  constructor() {
    super(undefined)
  }

  setup(_, attrs) {
    if (typeof attrs === 'string') {
      this.evalFunc(attrs)
    } else if (Array.isArray(attrs)) {
      attrs.forEach((cnt) => this.evalFunc(cnt))
    }
  }

  evalFunc(attrs: any) {
    try {
      /** @ts-ignore */
      const { Utils, Vars, Validate } = context
      eval(attrs)
    } catch (err) {
      context.error('%s: %j', err.message, attrs)
      throw err
    }
  }

  async exec() { }
}
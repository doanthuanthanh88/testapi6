import { context } from "@/Context";
import { Tag } from "./Tag";

/**
 * Create new utility functions
 * 
 * Some utility functions which system provided:
 * - json: Convert to json format
 * - yaml: Convert to yaml format
 * - schema: Validate object schema
 * - base64: Convert to base64 string
 * - md5: Convert to md5 string
 * - sign: Format number (+1 or -1)
 * - random: Return random string
 * - lodash: Return lodash object. (https://lodash.com)
 * 
 * ```yaml
 * - Utils:
 *     toLower: txt => txt?.toLowerCase()
 *     toUpper: txt => txt?.toUpperCase()
 * ###
 * - Echo: ${Utils.toLower('Hello world')}
 * - Echo: ${Utils.lodash.merge({a: 1}, {b: 2})}
 * ```
 */
export class Utils extends Tag {

  init() {
    super.init(undefined)
  }

  setup(_, attrs = {}) {
    // @ts-ignore
    const { Vars, Validate, Utils } = context
    // @ts-ignore
    const Context = context
    for (const funcName in attrs) {
      eval(`Utils["${funcName}"] = ${attrs[`${funcName}`]}`)
    }
    return this
  }

  async exec() { }
}
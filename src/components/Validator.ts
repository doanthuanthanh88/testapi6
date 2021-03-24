import { Tag } from "./Tag";
import Chai from 'chai'
import { ContentScript } from "./Script";
import { context } from "@/Context";

/**
 * Create new validation functions
 * 
 * ```yaml
 * - Validator:
 *     lowerCheck: |
 *       (actual, expected) => {
 *         if(actual?.toLowerCase() !== expected?.toLowerCase()) assert.fail(actual, expected, 'String lower not match', 'toLowerCheck')
 *       }
 *     chaiTest: |
 *       utils.addChainableMethod(chai.Assertion.prototype, 'chaiTest', function (str) {
 *         var obj = utils.flag(this, 'object');
 *         new chai.Assertion(obj).to.be.equal(str);
 *       });
 * ###
 * - Vars:
 *     obj: { name: Name 1 }
 *  
 * - Validate:
 *     title: Validate object schema which use builtin system
 *     func: schema
 *     args: 
 *       - ${obj}
 *       - { "type": "array" }
 *  
 * - Echo: Test custom validation
 * - Validate:
 *     title: check name ignore case lower
 *     func: lowerCheck
 *     args:
 *       - ${obj.name}
 *       - name 12
 * - Validate:
 *     title: check name ignore case upper
 *     func: upperCheck
 *     args:
 *       - ${obj.name}
 *       - name 1
 * 
 * - Echo: Use chaijs (assert, expect) to validate (https://www.chaijs.com/api/bdd/)
 *  
 * - Validate:
 *     title: Check name
 *     func: expect.to.equal
 *     args:
 *       - ${obj.name}
 *       - Name 1
 * - Validate:
 *     title: check 2 objects equals
 *     func: expect.to.deep.equal
 *     args:
 *       - ${obj}
 *       - {name: 'Name 1'}
 * - Validate:
 *     title: Check object got value
 *     func: assert.isOk
 *     args:
 *       - ~
 * - Validate:
 *     title: Check chaiTest
 *     func: expect.to.be.chaiTest
 *     args:
 *       - Test
 * ```
 */
export class Validator extends Tag {
  constructor(_attrs: { [name: string]: ContentScript }) {
    super(undefined)
  }

  setup(_, attrs = {}) {
    const chai = Chai
    // @ts-ignore
    const { Validate, Utils } = context
    // @ts-ignore
    const { expect, assert, util } = chai
    // @ts-ignore
    const utils = util
    for (const funcName in attrs) {
      eval(`Validate["${funcName}"] = ${attrs[`${funcName}`]}`)
    }
    return this
  }

  async exec() { }
}
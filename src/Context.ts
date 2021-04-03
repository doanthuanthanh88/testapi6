import { EventEmitter } from 'events'
import { inspect } from 'util'
import { Testcase } from '@/components/Testcase'
import { toJsonSchema } from "./components/doc/DocUtils";
import crypto from 'crypto'
import { Validator } from 'jsonschema';
import { safeDump } from 'js-yaml';
import * as lodash from 'lodash'

process.setMaxListeners(0)

/** Global Context */
export class Context {
  ExternalLibraries = {}
  /** Test case */
  tc: Testcase
  space = []
  /** Test result */
  get Result() {
    return this.tc?.result
  }
  /** Global variables */
  Vars = {} as any
  /** Global utilities */
  Utils = {
    /** Encrypt/Decrupt AES data */
    crypto: {
      /** Encrypt AES data */
      encryptAES(text: string, salt: string) {
        const hash = crypto.createHash("sha1")
        hash.update(salt);
        const key = hash.digest().slice(0, 16);
        const iv = crypto.randomBytes(16)
        const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
        const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
        return iv.toString('hex') + ':' + encrypted.toString('hex')
      },
      /** Decrypt AES data */
      decryptAES(text: string, salt: string) {
        const hash = crypto.createHash("sha1")
        hash.update(salt);
        const key = hash.digest().slice(0, 16);
        const textParts = text.split(':')
        const iv = Buffer.from(textParts.shift(), 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()])
        return decrypted.toString()
      }
    },
    /** Format data to json */
    json(obj: any) {
      if (typeof obj !== null && typeof obj === 'object') {
        return JSON.stringify(obj, null, '  ')
      }
      return obj
    },
    /** Format data to yaml */
    yaml(obj: any) {
      if (typeof obj !== null && typeof obj === 'object') {
        return safeDump(obj)
      }
      return obj
    },
    /** Get object schema */
    schema(obj: any, opts: any) {
      return toJsonSchema(obj, opts)
    },
    /** Get base64 string */
    base64(txt: string) {
      return txt && Buffer.from(txt).toString('base64')
    },
    /** Get md5 string */
    md5(txt: string) {
      return txt && crypto.createHash('md5').update(txt).digest('hex')
    },
    /** Show sign number */
    sign(vl: string | number) {
      vl = +vl
      return (vl > 0 ? '+' : '') + vl
    },
    /** Get random string */
    random() {
      return crypto.randomBytes(4).readUInt32LE(0)
    },
    /** Get lodash object */
    lodash,
  }
  /** Global validator */
  Validate = {
    /** Validate object schema */
    schema(data, schema, opts) {
      var v = new Validator()
      const rs = v.validate(data, schema, opts)
      if (!rs.valid) {
        throw {
          message: rs.errors.map(e => e.stack).join('\n'),
          actual: JSON.stringify(data),
          expected: JSON.stringify(schema),
        }
      }
    },
    /** Match data length */
    length(a, b) {
      if ((!Array.isArray(a) && typeof a !== 'string') || typeof b !== 'number') throw {
        message: 'Data type not match',
        actual: a,
        expected: b
      }
      if (a.length !== b) throw {
        message: 'Length not match',
        actual: a.length,
        expected: b
      }
    },
    /** Match 2 objects */
    match(a, b) {
      if (!lodash.isEqual(a, b)) throw {
        message: 'Data not match',
        actual: a,
        expected: b
      }
    },
    /** Validate including data */
    in(a, b) {
      if (!b.includes(a)) {
        throw {
          message: 'Data not in',
          actual: a,
          expected: b
        }
      }
    },
    equals: 'expect(?).to.equal(?)',
    notEquals: 'expect(?).to.not.equal(?)',
    deepEquals: 'expect(?).to.deep.equal(?)',
    deepIncludes: 'expect(?).to.deep.include(?)',
    notIncludes: 'expect(?).to.not.include(?)',
    haveDeepMembers: 'expect(?).to.have.deep.members(?)',
    haveNotMembers: 'expect(?).to.not.have.members(?)',
    haveDeepProperty: 'expect(?).to.have.deep.property(?)',
    notHaveProperty: 'expect(?).to.not.have.property(?)',
    empty: 'expect(?).to.not.be.empty(?)',
    notEmpty: 'expect(?).to.not.be.empty(?)',
  }
  private _event = new EventEmitter()
  constructor() {
    this._event.setMaxListeners(0)
    this._event.on('log', (msg, isError) => {
      if (isError) console.log(msg)
      else console.error(msg)
    })
    this._event.on('clear', () => {
      console.clear()
    })
  }
  /** Listen event */
  on(event: string, listener: any) {
    this._event.on(event, listener)
    return this._event
  }
  /** Listen event once time then ignore */
  once(event: string, listener: any) {
    this._event.once(event, listener)
    return this._event
  }
  /** Emit event */
  emit(event: string, ...args: any[]) {
    this._event.emit(event, ...args)
    return this._event
  }
  /** Print without any spaces */
  print(...args: any[]) {
    // this._event.emit('log', format(fm, ...args))
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Clear screen */
  clear() {
    // this._event.emit('clear')
    console.clear()
  }
  /** Print log with space in group */
  log(...args) {
    // this._event.emit('log', this.space.join('') + format(fm, ...args))
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Print table */
  table(arrs: string[][], opts?: any) {
    console.table(arrs, opts)
  }
  /** Print error with space in group */
  error(...args) {
    // this._event.emit('log', this.space.join('') + format(fm, ...args), true)
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Add spaces before log */
  group(...args: any[]) {
    console.group(...args)
    // this.log(fm, ...args)
    // this.space.push('  ')
  }
  /** Remove spaces */
  groupEnd() {
    // this.space.splice(0, 1)
    console.groupEnd()
  }
}

export const context = new Context()

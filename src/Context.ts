import { Testcase } from '@/components/Testcase';
import { EventEmitter } from 'events';
import { inspect } from 'util';

process.setMaxListeners(0)

/** Global Context */
export class Context {
  ExternalLibraries = {}
  /** Test case */
  tc: Testcase
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
        const crypto = require('crypto')
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
        const crypto = require('crypto')
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
        const { safeDump } = require('js-yaml')
        return safeDump(obj)
      }
      return obj
    },
    /** Get object schema */
    schema(obj: any, opts: any) {
      const { toJsonSchema } = require('./components/doc/DocUtils')
      return toJsonSchema(obj, opts)
    },
    /** Get base64 string */
    base64(txt: string) {
      return txt && Buffer.from(txt).toString('base64')
    },
    /** Get md5 string */
    md5(txt: string) {
      if (txt) {
        const crypto = require('crypto')
        txt = crypto.createHash('md5').update(txt).digest('hex')
      }
      return txt
    },
    /** Show sign number */
    sign(vl: string | number) {
      vl = +vl
      return (vl > 0 ? '+' : '') + vl
    },
    /** Get random string */
    random() {
      const crypto = require('crypto')
      return crypto.randomBytes(4).readUInt32LE(0)
    },
    /** Get lodash object */
    get lodash() {
      return require('lodash')
    }
  }
  /** Global validator */
  Validate = {
    /** Validate object schema */
    schema(data, schema, opts) {
      const { Validator } = require('jsonschema')
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
      const { isEqual } = require('lodash')
      if (!isEqual(a, b)) throw {
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
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Clear screen */
  clear() {
    console.clear()
  }
  /** Print log with space in group */
  log(...args) {
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Print table */
  table(arrs: string[][], opts?: any) {
    console.table(arrs, opts)
  }
  /** Print error with space in group */
  error(...args) {
    console.log(...args.map(a => typeof a === 'object' ? inspect(a, { depth: null }) : a))
  }
  /** Add spaces before log */
  group(...args: any[]) {
    console.group(...args)
  }
  /** Remove spaces */
  groupEnd() {
    console.groupEnd()
  }
}

export const context = new Context()

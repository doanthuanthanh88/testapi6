import { mergeWith, merge, flatten, cloneDeep, omit } from 'lodash'
import { Testcase } from '@/components/Testcase'
import { context } from '../Context'
import { Replacement } from '@/Replacement'

export const REMOVE_CHARACTER = null

export async function Import(arrs: any[], tc: Testcase) {
  if (arrs && arrs.length > 0) {
    const tags = []
    for (const t of flatten(arrs).filter(e => e)) { //  { [tag: string]: any }
      const tagName = Object.keys(t)[0]
      try {
        let TagClass = require('.')[tagName]
        if (!TagClass) {
          TagClass = context.ExternalLibraries[tagName]
          if (!TagClass) {
            throw new Error(`Could not found the tag "${tagName}"`)
          }
        }
        let tag = new TagClass(t[tagName]) as Tag
        tag.tagName = tagName
        let _tag = await tag.setup(tc, t[tagName])
        if (_tag) tag = _tag
        if (tag.preload) {
          await tag.prepare(tc)
          if (!tag.disabled) {
            try {
              await tag.beforeExec()
              await tag.exec()
            } finally {
              await tag.dispose()
            }
          }
        } else if (tag.setup && tag.exec) {
          tags.push(tag)
        } else {
          const ts = await Import(Array.isArray(tag) ? tag : [tag], tc)
          tags.push(...ts.filter(e => e))
        }
      } catch (err) {
        err.tagName = tagName
        throw err
      }
    }
    return tags
  }
}

export abstract class Tag {
  $$: Tag
  id: number
  tc: Testcase
  error: any
  tagName: string
  preload: boolean

  /** Only allow run it then ignore others which not set testIt or set it to false */
  testIt: boolean
  /** Ignore this, not run */
  disabled: boolean
  /** Not show log */
  slient: boolean
  /** Declare global variable */
  vars: any
  /** Keep run the next when got error */
  ignoreError: boolean
  /** Run async */
  async: boolean
  /** Step title */
  title: string

  constructor(attrs: any, attrName?: string) {
    const base = {}
    if (attrName) {
      attrs = typeof attrs !== 'string' ? attrs : { [attrName]: attrs }
    }
    if (attrs) {
      const { Templates } = require('.')
      const ext = ((attrs['<-'] && !Array.isArray(attrs['<-'])) ? (attrs['<-'] as string).split(',').map(e => e.trim()) : attrs['<-']) as string[]
      ext?.forEach(key => {
        merge(base, cloneDeep(Templates.Templates.get(key) || {}))
      })

      merge(base, omit(attrs, ['<-', '->']))

      const exp = ((attrs['->'] && !Array.isArray(attrs['->'])) ? attrs['->'].split(',').map(e => e.trim()) : attrs['->']) as string[]
      exp?.forEach(key => {
        Templates.Templates.set(key, cloneDeep(base) as any)
      })
    }
    merge(this, base)
  }

  get context() {
    return context
  }

  setup(tc: Testcase, _attrs?: any): any {
    this.tc = tc
    return this
  }

  setVar(varName: any, value: any) {
    if (typeof varName === 'string') {
      context.Vars[varName] = value
    } else {
      for (const k in varName) {
        context.Vars[k] = this.replaceVars(varName[k], { ...context.Vars, Vars: context.Vars, $: this, $$: this.$$, Utils: context.Utils, Result: context.Result })
      }
    }
  }

  prepare(scope?: any, ignore = []) {
    if (this.vars && !ignore.includes('vars')) {
      this.vars = this.replaceVars(this.vars, { ...context.Vars, Vars: context.Vars, $: scope || this, $$: (scope || this)?.$$, Utils: context.Utils, Result: context.Result }, [])
      merge(context.Vars, this.vars)
    }
    this.replaceVars(this, { ...context.Vars, Vars: context.Vars, $: scope || this, $$: (scope || this)?.$$, Utils: context.Utils, Result: context.Result }, ['steps', 'var', 'vars', 'context', ...ignore])
  }

  beforeExec() {
    context.emit('app:execute', this, this['loop'])
  }

  abstract exec()

  dispose() { }

  replaceVars(obj: any, ctx?: any, ignores = []) {
    if (!ctx) ctx = context
    return replaceVars(obj, ctx, ignores)
  }
}

export function replaceVars(obj: any, ctx = context.Vars, ignores = []) {
  ignores.push('tc', 'group', 'attrs', '$$', 'context', 'steps', 'templates', '_shadow')
  return _replaceVars(obj, ctx, ignores)
}

function _replaceVars(obj: any, context = {}, ignores = []) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = _replaceVars(obj[i], context)
    }
  } else if (typeof obj === 'object' && (obj.constructor === Object || obj instanceof Tag)) {
    for (const _k in obj) {
      if (ignores.includes(_k)) continue
      if (_k === '...') {
        _merge(obj, _replaceVars(obj[_k], context))
        delete obj[_k]
      } else {
        const k = _replaceVars(_k, context)
        obj[k] = _replaceVars(obj[_k], context)
        if (k !== _k) delete obj[_k]
      }
    }
  } else if (typeof obj === 'string') {
    if (obj.includes('${')) {
      const rs = Replacement.getValue(obj, context)
      return rs
      // obj = getValue(obj, context)
    }
  }
  return obj
}

const PatternVars = {
  Object: /^\$\{((?!.*(\$\{)).*)\}$/sm,
  String: /\$\{([^\}]+)\}+/sm,
}

// @ts-ignore
function getValue(obj: any, context: any) {
  let isHandlePattern
  // obj = obj.replace(/([^A-Za-z_$]|^)this([\[\.\]])/g, '$1$.$2')
  let m = obj.match(PatternVars.Object)
  if (m) {
    try {
      obj = eval(_getFunc(m[1], context))
    } catch (err) {
      throw new Error(`Replace variable "${m[1]}" error`)
    }
    isHandlePattern = true
  } else {
    const isOk = PatternVars.String.test(obj)
    if (isOk) {
      try {
        obj = eval(_getFunc(`\`${obj}\``, context))
      } catch (err) {
        throw new Error(`Replace variable "${obj}" error`)
      }
      isHandlePattern = true
    }
  }
  if (isHandlePattern && typeof obj === 'string' && /\$\{[^\}]+\}/.test(obj)) {
    const nvl = _replaceVars(obj, context)
    if (nvl !== obj) obj = nvl
  }
  return obj
}

function _getFunc(obj, context) {
  const declare = Object.keys(context).map(k => `const ${k} = context.${k}`).join('\n')
  return `(() => {
    ${declare}
    return ${obj}
  })()`
}

function _merge(a, ...b) {
  // return merge(a, ...b)
  return mergeWith(a, ...b.map(b => {
    const flat = b['...']
    if (!flat) return b
    delete b['...']
    if (Array.isArray(flat)) {
      let obj = {}
      for (const a of flat) {
        obj = _merge({}, obj, a)
      }
      return _merge({}, obj, b)
    } else {
      return _merge({}, flat, b)
    }
  }), (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      const rs = merge([], a, b)
      return rs.filter(e => e !== REMOVE_CHARACTER)
    }
  })
}
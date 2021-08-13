import { Testcase } from '@/components/Testcase'
import { Replacement } from '@/Replacement'
import { cloneDeep, merge, mergeWith, omit } from 'lodash'
import { context } from '../Context'
import { Components } from './index'

export const REMOVE_CHARACTER = null

export async function Import(arrs: any[], tc: Testcase) {
  if (arrs && arrs.length > 0) {
    const tags = []
    for (const t of arrs.flat().filter(e => e)) { //  { [tag: string]: any }
      if (Object.keys(t).length !== 1) throw new Error(`Format tag is not valid "${Object.keys(t).join(',')}"`)
      const tagName = Object.keys(t)[0]
      try {
        let TagClass = Components[tagName]
        if (!TagClass) {
          TagClass = context.ExternalLibraries[tagName]
          if (!TagClass) {
            throw new Error(`Could not found the tag "${tagName}"`)
          }
        }
        let tag = new TagClass() as Tag
        tag.init(t[tagName])
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
  static Cached = new Map<string, Tag>()
  static ignores = [
    'error',
    'tagName',
    'preload',
    'icon',
  ]
  $$: Tag
  id: string
  tc: Testcase
  error: any
  tagName: string
  preload: boolean
  icon: string

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

  init(attrs: any, attrName?: string) {
    const base = { '<--': [], '-->': [], tagName: this.constructor.name }
    if (attrName) {
      attrs = typeof attrs === 'object' ? attrs : { [attrName]: attrs }
    }
    if (attrs) {
      const _extends = typeof attrs['<-'] === 'string' ? attrs['<-'].split(',').map(e => e.trim()) : attrs['<-']
      const _expose = typeof attrs['->'] === 'string' ? attrs['->'].split(',').map(e => e.trim()) : attrs['->']

      _extends?.forEach(key => {
        const { Templates } = require('./Templates')
        merge(base, cloneDeep(Templates.Templates.get(key) || {}))
        base['<--'].push(key)
      })

      merge(base, omit(attrs, ['<-', '->']))

      _expose?.forEach(key => {
        const { Templates } = require('./Templates')
        Templates.Templates.set(key, cloneDeep(base) as any)
        base['-->'].push(key)
      })
    }
    merge(this, base)
  }

  clone(..._ignoreClone: string[]) {
    // console.time('default')
    // const ig = new Set(['vars', '$$', 'tc', 'error', ...ignoreClone])
    // let self = cloneDeepWith(this, (vl, k: any) => {
    //   if (!ig.has(k)) {
    //     return vl
    //   }
    //   return vl
    // })
    // console.timeEnd('default')
    // console.time('clone')
    return cloneDeep(this)
    // console.timeEnd('clone')
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
      const varContext = this.getReplaceVarsContext()
      for (const k in varName) {
        varContext[k] = context.Vars[k] = this.replaceVars(varName[k], varContext)
      }
    }
  }

  static cleanObject(obj) {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) {
      obj.forEach((o, i) => {
        if (o === null || o === undefined) {
          delete obj[i]
        } else {
          Tag.cleanObject(o)
        }
      })
    } else {
      Object.keys(obj).forEach(k => {
        const o = obj[k]
        if (o === null || o === undefined) {
          delete obj[k]
        } else {
          Tag.cleanObject(o)
        }
      })
    }
    return obj
  }

  getReplaceVarsContext(scope?: any) {
    return {
      ...context.Vars,
      Vars: context.Vars,
      Utils: context.Utils,
      Result: context.Result,
      $: scope || this,
      $$: (scope || this)?.$$
    }
  }

  prepare(scope?: any, ignore = []) {
    const varContext = this.getReplaceVarsContext(scope)
    if (this.vars && !ignore.includes('vars')) {
      this.vars = this.replaceVars(this.vars, varContext, [])
      merge(context.Vars, this.vars)
    }
    this.replaceVars(this, varContext, ['var', 'vars', 'context', ...ignore])
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
  ignores.push('tc', 'group', 'attrs', '$$', 'context', 'steps', 'templates')
  return _replaceVars(obj, ctx, ignores)
}

function _replaceVars(obj: any, context = {}, ignores = []) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = _replaceVars(obj[i], context, [])
    }
  } else if (typeof obj === 'object') {
    for (const _k in obj) {
      if (_k === '...') {
        _merge(obj, _replaceVars(obj[_k], context, []))
        delete obj[_k]
      } else if (ignores.includes(_k) || /^[^a-zA-Z]/.test(_k)) {
        continue
      } else {
        const k = _replaceVars(_k, context, [])
        obj[k] = _replaceVars(obj[_k], context, [])
        if (k !== _k) delete obj[_k]
      }
    }
  } else if (typeof obj === 'string' && obj.includes('${')) {
    let rs = obj
    do {
      rs = Replacement.getValue(rs, context)
    } while (typeof rs === 'string' && rs.includes('${'))
    return rs
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
    // delete b['...']
    b['...'] = undefined
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
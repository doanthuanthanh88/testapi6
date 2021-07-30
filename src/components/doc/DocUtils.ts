import { merge } from "lodash"

export function getDocType(data: any) {
  const type = {} as any
  if (data) {
    if (Array.isArray(data)) {
      type.type = 'array'
      type.items = {}
      for (const item of data) {
        type.items = merge(type.items, getDocType(item))
      }
    } else if (typeof data === 'object') {
      type.type = 'object'
      type.required = []
      type.properties = {}
      Object.keys(data).forEach(key => {
        const isStarKey = key.includes('*')
        if (isStarKey) {
          const rawKey = key.replace(/\*/g, '')
          data[rawKey] = data[rawKey] || data[key]
          // data[key] = undefined
          delete data[key]
          key = rawKey
          type.required.push(key)
        }
        if (Array.isArray(data[key])) {
          type.properties[key] = getDocType(data[key])
        } else if (typeof data[key] === 'object') {
          type.properties[key] = getDocType(data[key])
        }
      })
    }
    if (type.required && !type.required.length) {
      delete type.required
    }
  }
  return type
}

export function applyPropsJSONSchema(obj: any, schema: any) {
  if (obj) {
    if (schema.type === 'object') {
      for (const k in schema.properties) {
        if (!obj[k]) continue
        if (!schema.required) schema.required = []
        if (obj[k]?.required) {
          schema.required.push(k)
        }
        if (obj[k]) applyPropsJSONSchema(obj[k], schema.properties[k])
      }
    } else if (schema.type === 'array') {
      if (obj) applyPropsJSONSchema(obj.schema, schema.items)
    }
  }
  return schema
}

export function schemaToMD(schema: any, _parent?: any, level = '', msg = []) {
  const { type, properties, required } = schema
  if (type === 'object') {
    for (const key in properties) {
      const prop = properties[key]
      const isRequired = required?.includes(key)
      const sign = isRequired ? '◦ *' : '◦ '
      let type = prop.enum ? `enum(${prop.enum.join(',')})` : prop.type
      if (type === 'array') {
        const details = `${(Array.isArray(prop.items) ? prop.items : [prop.items]).filter(e => e?.type).map(e => e.type).join('|')}`
        if (details) {
          type += '<' + details + '>'
        }
      }
      const mes = `${level}${sign}${key}: !${type} `
      let des = ''
      if (prop.description) {
        let space = mes.replace(/./g, ' ')
        des = prop.description.split('\n').filter(e => e).map((e, i) => `${i > 0 ? space : ''} # ${e.trim()}`).join('\n')
      }
      msg.push(mes + des)
      if (prop.type === 'object') {
        if (schema !== undefined) {
          schemaToMD(prop, schema, level + '  ', msg)
        }
      } else if (prop.type === 'array') {
        if (prop.items !== undefined) {
          schemaToMD(prop.items, prop, level + '  ', msg)
        }
      }
    }
  }
  return msg.join('\r\n')
}

export function mergeData(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return []
    let rs = mergeData(data[0])
    for (let i = 1; i < data.length; i++) {
      merge(rs, mergeData(data[i]))
    }
    return [rs]
  } else if (typeof data === 'object' && data !== null) {
    const rs = {}
    for (let k in data) {
      rs[k] = mergeData(data[k])
    }
    return rs
  }
  return data
}

export function isGotData(obj, isCheckEmptyObject = true) {
  if (obj === null || obj === undefined) return false
  if (Array.isArray(obj)) return true
  if (typeof obj === 'object') {
    if (isCheckEmptyObject) return Object.keys(obj).length > 0
    return !!obj
  }
  return true
}

export function toJsonSchema(data = null, opts = {
  objects: { additionalProperties: false },
  arrays: { mode: 'first' },
  strings: { detectFormat: false },
  // required: true
}) {
  const convert = require('to-json-schema')
  return convert(mergeData(data), opts)
}

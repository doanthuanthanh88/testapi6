import { merge, omit } from "lodash"

export function getDocType(data: any) {
  const type = {} as any
  if (data) {
    if (Array.isArray(data)) {
      type.type = 'array'
      type.items = {}
      for (const item of data) {
        const d = getDocType(item)
        const required = d.required || []
        delete d.required
        type.items = merge(type.items, d)
        if (required) {
          if (!type.items.required) type.items.required = []
          type.items.required = Array.from(new Set(type.items.required.concat(required)))
        }
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
        } else {
          type.properties[key] = {
            type: typeof data[key]
          }
        }
      })
    } else {
      type.type = typeof data
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

export function schemaToTableMD(schemas: any, schema: any, _parent?: any, level = '', msg = []) {
  if (level === '') {
    msg.push('| Field | Type | Description |')
    msg.push('| ---- | ----- | ---- |')
  }
  const { type, properties, required } = schema
  if (type === 'object') {
    for (const key in properties) {
      const prop = properties[key]
      let refType: string
      if (prop.$ref) {
        const typeNames = prop.$ref.split('/')
        const typeName = typeNames[typeNames.length - 1]
        if (schemas[typeName]) {
          merge(prop, schemas[typeName])
          refType = typeName
        }
      }
      const isRequired = required?.includes(key)
      const sign = isRequired ? ` ®` : ' '
      const types = []
      if (refType) {
        types.push(`${prop.type}&lt;<a href="#${refType}">${refType}</a>&gt;`)
      } else if (prop.type === 'array') {
        const details = `${(Array.isArray(prop.items) ? prop.items : [prop.items])
          .filter(e => e?.type || e?.$ref)
          .map(prop => {
            let refType: string
            if (prop.$ref) {
              const typeNames = prop.$ref.split('/')
              const typeName = typeNames[typeNames.length - 1]
              if (schemas[typeName]) {
                refType = `<a href="#${typeName}">${typeName}</a>`
              } else {
                refType = `<a href="">unknown</a>`
              }
            } else {
              refType = `<a href="">${prop.type}</a>`
            }
            return refType
          })
          .join(',')}`
        let type = prop.type
        if (details) {
          type += '&lt;' + details + '&gt;'
        }
        types.push(`${type}`)
      } else {
        if (prop.enum) {
          types.push(`enum&lt;<a href="">${prop.type}</a>&gt;`)
        } else {
          types.push(`<a href="">${prop.type}</a>`)
        }
        if (prop.enum) {
          types.push(`<br/>${prop.enum.map(vl => ` <code>${vl}</code>`).join('<br/>')}`)
        }
      }
      const type = types.join('')
      let des = ''
      if (prop.description) {
        des = prop.description.split('\n').filter(e => e).map((e) => `${e.trim()}`).join('<br/>')
      }
      msg.push(`| ${level.replace(/ /g, '&nbsp;')} ${sign}${key} | ${type} | ${des} |`)
      if (prop.type === 'object') {
        if (schema !== undefined) {
          schemaToTableMD(schemas, prop, schema, level + '    ', msg)
        }
      } else if (prop.type === 'array') {
        if (prop.items !== undefined) {
          schemaToTableMD(schemas, prop.items, prop, level + '    ', msg)
        }
      }
    }
  }
  return msg.join('\r\n')
}

export function schemaToMD(schemas: any, schema: any, _parent?: any, level = '', msg = []) {
  const { type, properties, required } = schema
  if (type === 'object') {
    for (const key in properties) {
      const prop = properties[key]
      let refType: string
      if (prop.$ref) {
        const typeNames = prop.$ref.split('/')
        const typeName = typeNames[typeNames.length - 1]
        if (schemas[typeName]) {
          merge(prop, schemas[typeName])
          refType = typeName
        }
      }
      const isRequired = required?.includes(key)
      const sign = isRequired ? '® ' : '◦ '
      const types = ['!']
      if (refType) types.push(`${refType}<`)
      types.push(`${prop.type}`)
      if (prop.enum) types.push(`(${prop.enum.join(',')})`)
      if (refType) types.push('>')
      const type = types.join('')
      if (type === 'array') {
        const details = `${(Array.isArray(prop.items) ? prop.items : [prop.items]).filter(e => e?.type).map(e => e.type).join('|')}`
        if (details) {
          prop.type += '<' + details + '>'
        }
      }
      const mes = `${level}${sign}${key}: ${type} `
      let des = ''
      if (prop.description) {
        let space = mes.replace(/./g, ' ')
        des = prop.description.split('\n').filter(e => e).map((e, i) => `${i > 0 ? space : ''} \t# ${e.trim()}`).join('\n')
      }
      msg.push(mes + des)
      if (prop.type === 'object') {
        if (schema !== undefined) {
          schemaToMD(schemas, prop, schema, level + '  ', msg)
        }
      } else if (prop.type === 'array') {
        if (prop.items !== undefined) {
          schemaToMD(schemas, prop.items, prop, level + '  ', msg)
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

function mergeDetails(a, b) {
  if (!a) return b
  if (!b) return a
  if (a.type === b.type) {
    if (a.type === 'object') {
      const rs = { type: 'object', properties: {} } as any
      for (const name in a.properties) {
        rs.properties[name] = mergeDetails(a.properties[name], b.properties && b.properties[name])
      }
      return rs
    } else if (a.type === 'array') {
      if (!Array.isArray(a.items)) a.items = [a.items]
      const fake = {
        type: 'array',
        items: (a.items || []).concat(b.items || [])
      }
      return mergeChild(fake)
    } else {
      return merge({}, a, b)
    }
  } else {
    if (a.type === 'array') {
      a = mergeChild(a)
    }
    if (b.type === 'array') {
      b = mergeChild(b)
    }
    return {
      type: 'object',
      oneOf: [a, b]
    }
  }
}

function mergeChild(obj: any) {
  if (obj.type === 'array') {
    if (!Array.isArray(obj.items)) obj.items = [obj.items]
    const rs = []
    for (let item of obj.items) {
      item = mergeChild(item)
      const idx = rs.findIndex(e => e.type === item.type)
      if (idx !== -1) {
        rs[idx] = mergeDetails(rs[idx], item)
      } else {
        rs.push(item)
      }
    }
    if (rs.length > 1) {
      obj.items = {
        oneOf: rs
      }
    } else {
      obj.items = rs[0]
    }
  }
  return obj
}

export function mergeSchema(schemaArr, schemaObj) {
  if (schemaObj?.messages) schemaArr.messages = schemaObj.messages
  if (schemaObj?.required?.length) schemaArr.required = schemaObj.required
  if (schemaObj?.deprecated) schemaArr.deprecated = schemaObj.deprecated
  let { type, properties } = schemaArr
  if (type === 'object') {
    for (const name in properties) {
      const schema = properties[name]
      mergeSchema(schema, schemaObj?.properties ? schemaObj.properties[name] : undefined)
    }
    // const keys = Object.keys(properties || {}).concat(Object.keys(schemaObj?.properties || {}))
    // for (const name of keys) {
    //   if (!properties) {
    //     schemaArr.properties = schemaObj?.properties || {}
    //   } else if (!properties[name]) {
    //     properties[name] = schemaObj?.properties && schemaObj.properties[name]
    //   } else {
    //     mergeSchema(properties[name], schemaObj?.properties && schemaObj.properties[name])
    //   }
    // }
  } else if (type === 'array') {
    let { items } = schemaArr
    if (!Array.isArray(items)) {
      items = [items]
    }
    if (schemaObj?.wrapper) {
      let [wrapperName, titleKeys = 'title'] = schemaObj.wrapper.split('#')
      delete schemaObj.wrapper
      delete schemaArr.wrapper
      titleKeys = titleKeys.split(',')
      schemaArr.items = {
        [wrapperName]: items.map((item, i) => {
          const titleKey = titleKeys[i] || titleKeys[0]
          item.title = (item.properties && item.properties[titleKey]) ? (item.properties[titleKey].description || item.properties[titleKey].example) : titleKey
          return mergeSchema(item, schemaObj.items)
        })
      }
    } else {
      let { items } = mergeChild(schemaArr)
      if (!Array.isArray(items)) {
        items = [items]
      }
      schemaArr.items = {}
      items.forEach(item => {
        merge(schemaArr.items, item)
      })
      return mergeSchema(schemaArr.items, schemaObj?.items)
    }
  } else {
    return merge(schemaArr, schemaObj)
  }
  return schemaArr
}

export function applyMessage(schema: any, globalMessages: any, childMessages: any, prefix = '') {
  let { type, messages, properties, moveTo } = schema
  if (moveTo) {
    let oneOf = schema[moveTo]
    const obj = omit(schema, 'moveTo', moveTo)
    if (Array.isArray(oneOf)) {
      schema[moveTo] = oneOf.map(o => merge(o, merge({}, obj, o)))
    } else if (typeof oneOf === 'object') {
      schema[moveTo] = merge(oneOf, merge({}, obj, oneOf))
    }
    delete schema.moveTo
    delete schema.properties
    delete schema.items
    applyMessage(schema, globalMessages, childMessages)
    return
  }
  if (type === 'object') {
    for (let name in properties) {
      const vl = properties[name]
      let _prefix = prefix
      let _messages
      if (messages) {
        if (typeof messages === 'string') {
          _messages = globalMessages[messages]
        } else {
          _messages = messages
        }
      } else if (childMessages) {
        _messages = childMessages
      }
      if (_messages) {
        if (messages) {
          prefix = ''
        }
        _prefix = `${prefix}${name}`
        if (!vl.description) {
          const des = _messages[`${_prefix}`]
          if (des) {
            if (des.includes('#/')) {
              const item = vl.items?.anyOf || vl.items?.allOf || vl.items?.oneOf || vl.items || vl
              let [title, ref] = des.split('|').map(e => e.trim())
              if (!ref) ref = title
              if (Array.isArray(item)) {
                item.forEach(it => {
                  it.$ref = ref
                  if (title) it.description = title
                  delete it.properties
                })
              } else {
                item.$ref = ref
                if (title) item.description = title
                delete item.properties
              }
            } else {
              vl.description = des
            }
          }
        }
      }
      if (vl.type === 'object') {
        applyMessage(vl, globalMessages, _messages, `${name}.`)
      } else if (vl.type === 'array' && vl.items) {
        if (vl.messages) vl.items.messages = vl.messages
        const mes = vl.items.messages
        if (mes) {
          if (typeof mes === 'string' && mes.includes('.')) {
            const model = mes.substr(0, mes.indexOf('.'))
            const fieldName = mes.substr(mes.indexOf('.') + 1)
            _messages = Object.keys(globalMessages[model]).reduce((sum, key) => {
              let newKey = key
              if (new RegExp(`^${fieldName}(\..+)?$`).test(key)) {
                newKey = newKey.replace(fieldName, name)
              }
              sum[newKey] = globalMessages[model][key]
              return sum
            }, {})
            delete vl.items.messages
            delete vl.messages
          }
        }
        const items = vl.items.oneOf || vl.items.anyOf || vl.items.allOf || vl.items
        if (Array.isArray(items)) {
          items.forEach(item => applyMessage(item, globalMessages, _messages, `${name}.`))
        } else {
          applyMessage(items, globalMessages, _messages, `${name}.`)
        }
        delete vl.items.messages
        delete vl.messages
      }
      delete schema.messages
    }
  } else if (type === 'array') {
    debugger
  }
}

export function toJsonSchema(data = null, isSetExample = true, opts = {
  objects: { additionalProperties: false },
  arrays: { mode: 'tuple' },
  strings: { detectFormat: false },
  postProcessFnc: (type, schema, value, defaultFunc) => {
    let example = value
    if (type === 'array') {
      if (!schema.items) {
        schema.items = [{ type: 'unknown' }]
      }
      return defaultFunc(type, schema, value)
    } else if (type === 'object' && value) {
      example = undefined
    }
    const rs = { ...schema }
    if (example !== undefined) rs.example = example
    return rs
  }
}) {
  const convert = require('to-json-schema')
  // const obj = convert(mergeData(data), opts)
  const obj = convert(JSON.parse(JSON.stringify(data)), opts)
  if (isSetExample) obj.example = data
  return obj
}

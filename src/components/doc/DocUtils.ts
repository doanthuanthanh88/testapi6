import { merge } from "lodash"
const convert = require('to-json-schema')

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

export function toJsonSchema(data, opts = {
  objects: { additionalProperties: false },
  arrays: { mode: 'first' },
  strings: { detectFormat: false },
  // required: true
}) {
  return convert(mergeData(data), opts)
}

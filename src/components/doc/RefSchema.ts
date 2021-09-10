import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { isNaN, merge, omit } from 'lodash';
import { basename, dirname, join } from 'path';

export class RefSchema {
  static refs = {} as { [file: string]: RefSchema }
  static ownerRefs = {} as { [key: string]: any }
  static ownerRefNames = {} as { [key: string]: string }
  inputFile: string
  data: any
  refs: Set<string>
  // paths: Set<string>
  refData = {} as { [file: string]: any }

  constructor(attrs: Partial<RefSchema>) {
    merge(this, attrs)
  }

  static getRefs(obj, refs: RefSchema, isDocPrefer: boolean) {
    if (Array.isArray(obj)) {
      obj.forEach(o => {
        RefSchema.getRefs(o, refs, isDocPrefer)
      })
    } else if (typeof obj === 'object') {
      for (const k in obj) {
        if (k === '$ref' && typeof obj[k] === 'string') {
          refs.refs.add(obj[k])
          if (!obj[k].startsWith('#/')) {
            const [inputFile, meta] = obj[k].split('#/')
            const yamlFile = join(dirname(refs.inputFile), inputFile)
            RefSchema.scan(yamlFile, undefined, meta, isDocPrefer)
            // merge(obj, RefSchema.refs[yamlFile].refData[meta])
            // delete obj[k]
            const ref = RefSchema.ownerRefNames[`${yamlFile}:::${meta}`]
            if (!ref) {
              if (isDocPrefer) {
                merge(obj, RefSchema.refs[yamlFile].refData[meta])
              } else {
                const _obj = merge({}, RefSchema.refs[yamlFile].refData[meta], obj)
                merge(obj, _obj)
              }
              delete obj[k]
            } else {
              obj[k] = ref
            }
          } else {
            const meta = obj[k].substr(2)
            RefSchema.scan(refs.inputFile, undefined, meta, isDocPrefer)
            const ref = RefSchema.ownerRefNames[`${refs.inputFile}:::${meta}`]
            if (!ref) {
              if (RefSchema.refs[refs.inputFile].refData[meta]) {
                merge(obj, RefSchema.refs[refs.inputFile].refData[meta])
                delete obj[k]
              }
            } else {
              obj[k] = ref
            }
          }
        } else {
          RefSchema.getRefs(obj[k], refs, isDocPrefer)
        }
      }
    }
  }

  static scan(inputFile: string, yamlAPI: any, path: string, isDocPrefer: boolean) {
    if (!RefSchema.refs[inputFile]) {
      let data: any
      const filename = basename(inputFile)
      if (filename === 'self.doc.openapi.tmp') {
        data = null
      } else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
        data = load(readFileSync(inputFile).toString())
      } else if (filename.endsWith('.json')) {
        data = JSON.parse(readFileSync(inputFile).toString())
      } else {
        throw new Error('Not support load from swagger file with format not .yaml or .json')
      }
      RefSchema.refs[inputFile] = new RefSchema({
        inputFile,
        data,
        refs: new Set<string>(),
        // paths: new Set<string>(),
        refData: {}
      })
    }
    if (path) {
      if (basename(inputFile) !== 'self.doc.openapi.tmp') {
        let tmp = RefSchema.refs[inputFile].data
        let typeName = ''
        path.split('/').forEach(p => {
          const name = decodeURIComponent(p)
          const m = name.match(/([^\[]+)(\[([^\]]+)?\])*/)
          if (m) {
            const field = m[1]
            const search = m[3]
            if (search) {
              if (search.includes('$omit=')) {
                tmp = omit(tmp[field], search.replace('$omit=', '').split(','))
              } else if (isNaN(+search)) {
                // Find item in array by some conditions
                const cond = search.split('&')
                tmp = tmp[field].find(e => {
                  for (const c of cond) {
                    const key = c.substr(0, c.indexOf('='))
                    let vl = c.substr(c.indexOf('=') + 1) as any
                    if (vl[0] === '+') vl = +vl
                    if (e[key] !== vl) {
                      return false
                    }
                  }
                  return true
                })
              } else {
                // Find item in array by index
                const index = +search
                tmp = tmp[field][index]
              }
            } else {
              tmp = tmp[name]
              typeName = name
            }
          } else {
            tmp = tmp[name]
            typeName = name
          }
        })
        if (!RefSchema.refs[inputFile].refData[path]) {
          RefSchema.refs[inputFile].refData[path] = omit(tmp, 'tags')
          const m = path.match(/^components\/schemas\/(.+)/)
          if (m && /[\/\[]]/.test(m[1]) && typeName) {
            RefSchema.refs[inputFile].refData[path].title = m[1]
            let key = typeName
            while (RefSchema.ownerRefs[key]) {
              key += '0'
            }
            RefSchema.ownerRefs[key] = RefSchema.refs[inputFile].refData[path]
            RefSchema.ownerRefNames[`${inputFile}:::${path}`] = `#/components/schemas/${key}`
          }
          // RefSchema.refs[inputFile].paths.add(path)
        }
        RefSchema.getRefs(tmp, RefSchema.refs[inputFile], isDocPrefer)
      }
      return
    }
    RefSchema.getRefs(yamlAPI, RefSchema.refs[inputFile], isDocPrefer)
  }
}
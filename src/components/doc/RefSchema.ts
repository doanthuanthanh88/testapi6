import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { merge, omit } from 'lodash';
import { basename, dirname, join } from 'path';

export class RefSchema {
  static refs = {} as { [file: string]: RefSchema }
  inputFile: string
  data: any
  refs: Set<string>
  // paths: Set<string>
  refData = {} as { [file: string]: any }

  constructor(attrs: Partial<RefSchema>) {
    merge(this, attrs)
  }

  static getRefs(obj, refs: RefSchema) {
    if (Array.isArray(obj)) {
      obj.forEach(o => {
        RefSchema.getRefs(o, refs)
      })
    } else if (typeof obj === 'object') {
      for (const k in obj) {
        if (k === '$ref' && typeof obj[k] === 'string') {
          refs.refs.add(obj[k])
          if (!obj[k].startsWith('#/')) {
            const [inputFile, meta] = obj[k].split('#/')
            const yamlFile = join(dirname(refs.inputFile), inputFile)
            if (yamlFile !== refs.inputFile) {
              RefSchema.scan(yamlFile, undefined, meta)
              merge(obj, RefSchema.refs[yamlFile].refData[meta])
            } else {
              RefSchema.scan(yamlFile, undefined, meta)
              merge(obj, RefSchema.refs[yamlFile].refData[meta])
            }
            delete obj[k]
          } else {
            const meta = obj[k].substr(2)
            RefSchema.scan(refs.inputFile, undefined, meta)
            merge(obj, RefSchema.refs[refs.inputFile].refData[meta])
            delete obj[k]
          }
        } else {
          RefSchema.getRefs(obj[k], refs)
        }
      }
    }
  }

  static scan(inputFile: string, yamlAPI: any, path: string) {
    if (!RefSchema.refs[inputFile]) {
      RefSchema.refs[inputFile] = new RefSchema({
        inputFile,
        data: basename(inputFile) !== 'self.doc.openapi.tmp' ? load(readFileSync(inputFile).toString()) : null,
        refs: new Set<string>(),
        // paths: new Set<string>(),
        refData: {}
      })
    }
    if (path) {
      if (basename(inputFile) !== 'self.doc.openapi.tmp') {
        let tmp = RefSchema.refs[inputFile].data
        path.split('/').forEach(p => {
          tmp = tmp[decodeURIComponent(p)]
        })
        RefSchema.refs[inputFile].refData[path] = omit(tmp, 'tags')
        // RefSchema.refs[inputFile].paths.add(path)
        RefSchema.getRefs(tmp, RefSchema.refs[inputFile])
      }
      return
    }
    RefSchema.getRefs(yamlAPI, RefSchema.refs[inputFile])
  }
}
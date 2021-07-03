import { keep, remove } from '@/components/tags/array'
import { upload } from '@/components/tags/upload'
import { Schema } from 'js-yaml'

/**
 * Parse file to stream
 * 
 * ```yaml
 * - Post:
 *     baseURL: http://abc.com
 *     url: /upload
 *     headers:
 *       content-type: multipart/form-data
 *     body:
 *       name: img.jpg
 *       file: !upload examples/assets/text.txt
 *     query: 
 *       name: abc
 *     validate:
 *       - Status: [200, 204]
 * ```
 */
export type TAG_UPLOAD = '!upload'

/**
 * Keep element in array
 * 
 * ```yaml
 * - Get:
 *     ->: base
 *     url: http://get...
 *     var: rs
 *     validate:
 *       - Status: 200
 *       - StatusText: OK
 * 
 * - Api:
 *     <-: base
 *     validate:
 *       - !remove     # Ignore validate status
 *       - !keep       # Validate Status text first
 *       - Status: 200 #Validate response status code must be 200
 * ```
 */
export type TAG_KEEP = '!keep'

/**
 * Remove element in array
 * 
 * ```yaml
 * - Get:
 *     ->: base
 *     url: http://get...
 *     var: rs
 *     validate:
 *       - Status: 200
 *       - StatusText: OK
 * 
 * - Api:
 *     <-: base
 *     validate:
 *       - !remove     # Ignore validate status
 *       - !keep       # Validate Status text first
 *       - Status: 200 #Validate response status code must be 200
 * ```
 */
export type TAG_REMOVE = '!remove'


export const SCHEMA = Schema.create([
  upload,
  remove,
  keep
])

export const Components = {
  // Http Request
  get Api() {
    return getComponent('Api', './api/Api')
  },
  get Delete() {
    return getComponent('Delete', './api/Delete')
  },
  get Get() {
    return getComponent('Get', './api/Get')
  },
  get Head() {
    return getComponent('Head', './api/Head')
  },
  get Patch() {
    return getComponent('Patch', './api/Patch')
  },
  get Post() {
    return getComponent('Post', './api/Post')
  },
  get Put() {
    return getComponent('Put', './api/Put')
  },
  // Benchmark Http API
  get IWrk() {
    return getComponent('Wrk', './benchmark/Wrk')
  },
  // Data handler
  get Regex() {
    return getComponent('Regex', './data_handler/Regex')
  },
  get Validate() {
    return getComponent('Validate', './data_handler/Validate')
  },
  // Documentation
  get DocMarkdown() {
    return getComponent('DocMarkdown', './doc/DocMarkdown')
  },
  get DocSequence() {
    return getComponent('DocSequence', './doc/DocSequence')
  },
  get DocMermaid() {
    return getComponent('DocMermaid', './doc/DocMermaid')
  },
  get DocSwagger() {
    return getComponent('DocSwagger', './doc/DocSwagger')
  },
  // External
  get Exec() {
    return getComponent('Exec', './external/Exec')
  },
  get PreExec() {
    return getComponent('PreExec', './external/PreExec')
  },
  // Common
  get Group() {
    return getComponent('Group', './Group')
  },
  get Import() {
    return getComponent('Import', './Import')
  },
  // Input
  get Input() {
    return getComponent('Input', './input/Input')
  },
  get Load() {
    return getComponent('Load', './input/Load')
  },
  // Output
  get Clear() {
    return getComponent('Clear', './output/Clear')
  },
  get Echo() {
    return getComponent('Echo', './output/Echo')
  },
  get OutputFile() {
    return getComponent('OutputFile', './output/OutputFile')
  },
  get Schema() {
    return getComponent('Schema', './output/Schema')
  },
  get Pause() {
    return getComponent('Pause', './Pause')
  },
  get Require() {
    return getComponent('Require', './Require')
  },
  get Script() {
    return getComponent('Script', './Script')
  },
  get Templates() {
    return getComponent('Templates', './Templates')
  },
  get Utils() {
    return getComponent('Utils', './Utils')
  },
  get Validator() {
    return getComponent('Validator', './Validator')
  },
  get Vars() {
    return getComponent('Vars', './Vars')
  },
}

export function getComponent(name: string, path: string) {
  return require(path)[name]
}

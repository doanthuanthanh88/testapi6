import { upload } from '@/components/tags/upload'
import { remove, keep } from '@/components/tags/array'
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

export * from './Require'

/**
 * Api
 */
export * from './api/Api'
export * from './api/Delete'
export * from './api/Get'
export * from './api/Head'
export * from './api/Patch'
export * from './api/Post'
export * from './api/Put'

/**
 * Benchmark API
 */
export { IWrk } from './benchmark/Wrk'

/**
 * Documentation
 */
export * from './doc/DocMarkdown'
// export * from './doc/DocMermaid'
export * from './doc/DocSwagger'
export * from './doc/DocSequence'

/**
 * External
 */
export * from './external/Exec'
export * from './external/PreExec'

/**
 * Input
 */
export * from './input/Input'
export * from './input/Load'

/**
 * Output
 */
export * from './output/Clear'
export * from './output/Echo'
export * from './output/Schema'
export * from './output/OutputFile'

/**
 * Data handler
 */
export * from './data_handler/Regex'
export * from './data_handler/Validate'

/**
 * Common
 */
export * from './Group'
export * from './Import'
export * from './Pause'
export * from './Script'
export * from './Templates'
export * from './Vars'
export * from './Utils'
export * from './Validator'
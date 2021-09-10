import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios'
import chalk from 'chalk'
import { merge, mergeWith } from 'lodash'
import { parse, stringify } from 'querystring'
import { URLSearchParams } from "url"
import { deflateSync } from 'zlib'
import { context } from '../../Context'
import { IWrk, Wrk } from "../benchmark/Wrk"
import { Validate } from "../data_handler/Validate"
import { getDocType } from '../doc/DocUtils'
import { Operation } from "../doc/OpenAPI3"
import { Tag } from "../Tag"
import { Testcase } from "../Testcase"
import { CURLParser } from './CUrlParser'

context
  .on('log:api:begin', (api: Api) => {
    if (!api.slient && !api.depends) {
      context.log(`${chalk.green('%s')} ${chalk.green('%s')}\t${chalk.yellow('%s')}${chalk.gray.underline('%s %s')}`, api.icon, api.title, api.docs ? '★ ' : '', api.method.toString(), api._axiosData.fullUrlQuery(false))
    }
  })
  .on('log:api:validate:done', (_api: Api) => {
    // Validate done
  })
  .on('log:api:done', (api: Api) => {
    if (!api.slient) {
      if (!api.depends) {
        context.log(`  ${chalk.gray(api.iconResponse)} ${chalk[api.response?.ok ? 'green' : 'red']('%s')} ${chalk.gray('%s')} ${chalk.gray.italic('%s')}`, api.response?.status.toString(), api.response?.statusText, ` (${api.time.toString()}ms)`)
      } else if (api.title) {
        context.log('  %s %s \t %s', chalk.green('☑'), chalk.magenta(api.title), chalk.gray.underline(`${api.method} ${api._axiosData.fullUrl}`))
      }
    }
    if (api.debug === 'curl') {
      context.group('')
      context.log(`${chalk.green('⬤')} ${chalk.gray.underline('%s')}`, api.toCUrl())
      context.groupEnd()
    } else if (['details', 'response', 'request'].includes(api.debug as string)) {
      context.group('')
      api.logDetails()
      context.groupEnd()
    }
  })
  .on('log:api:end', (api: Api) => {
    if (api.debug === true || api.error) {
      context.group('')
      context.log(`${chalk.red('⬤')} ${chalk.underline.gray('%s')}`, api.toTestLink())
      context.groupEnd()
    }
    if (api.error) {
      api.tc.result.failed++
      context.log(chalk.red(api.error.message))
    }
  })

/**
 * Http method
 */
export enum Method {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  PATCH = 'PATCH',
}

/**
 * Http request
 * 
 * ```yaml
 * - Api:
 *     method: GET 
 *     baseURL: http://abc.com
 *     url: /test/{class}
 *     headers:
 *       Authorization: Bearer ...
 *     query: 
 *       name: abc
 *     params:
 *       class*: A
 *     validate:
 *       - Status: [200, 204]
 * ```
 */
export class Api extends Tag {
  static Index = 0
  static ignores = [
    ...Tag.ignores,
    'iconResponse',
    'index',
    'var',
    'time',
    '->',
    '<-',
    'depends',
    'response',
    'validate',
    'docs',
  ]
  icon = '→'
  iconResponse = '↳'
  index = 0
  /** Description */
  description: string
  /** Request base URL */
  baseURL: string
  /** How to log for debugging */
  debug: boolean | 'curl' | 'details' | 'request' | 'response'
  /** Request url */
  url: string
  /** Http method */
  method: Method
  /** Set timeout for the request */
  timeout: number
  /** 
   * Set data after request done
   * 
   * ```yaml
   * string: set response data to this var
   * object: set customize response to each properties in this var
   * ```
   */
  var: string | { [key: string]: any }
  /** Save response to file */
  saveTo?: string
  /** Execution time */
  time: number
  /** Expose a tag */
  '->': string
  /** Extends from a expose tag */
  '<-': string | string[]
  /** Only validate for the before step */
  depends: boolean
  /** Load from curl command */
  curl?: string
  /** Request body */
  body: any
  /** Request query string */
  query: Record<string, any>
  /** Request params which is declare on url */
  params: Record<string, any>
  /** Response object */
  response: {
    ok: boolean
    /** Response status code */
    status: number
    /** Response status text */
    statusText: string
    /** Response header */
    headers: { [key: string]: string },
    /** Response data */
    data: any
  }
  /** Request headers */
  headers: any
  // $url: URL
  /** Validate after request done */
  validate: Validate[]

  /** Generate to document */
  docs?: {
    /** Only doc these request headers */
    allowHeaders?: string[]
    /** Only doc these response headers */
    allowResponseHeaders?: string[]
    /** Group API document */
    tags?: string[]
    query?: any
    params?: any
    headers?: any
    responseHeaders?: any
    deprecated?: boolean
    body?: any
    data?: any
    /** Config for openapi document */
    openapi?: Operation & { ref?: string, path?: string, method?: string }
    /** Config for markdown document */
    md?: {
      /** Group API document */
      tags?: string[]
    }
    /** Config for swagger document */
    swagger?: Operation & { ref?: string, path?: string, method?: string }
  }

  /** 
   * Test benchmark base on wrk
   * 
   * @type IWrk
   * */
  benchmark?: {
    /** Execute wrk command line to test benchmark */
    wrk: IWrk
  }

  _axiosData: AxiosRequestConfig & {
    fullPathQuery(isEncode: boolean): string
    fullUrlQuery(isEncode: boolean): string
    fullUrl: string
    readonly contentType: string
  }
  _axios: AxiosInstance
  _controller: CancelTokenSource
  _benchmark?: Wrk
  isRunBenchmark: boolean

  static getMethodTag(method: string) {
    return method[0].toUpperCase() + method.substr(1).toLowerCase()
  }

  init(attrs: Api) {
    super.init(attrs)
    if (this.curl) {
      const meta = CURLParser.parse(this.curl)
      const { method, url, headers, query, body, baseURL } = meta
      if (!this.method) this.method = method.toUpperCase()
      if (!this.baseURL) this.baseURL = baseURL
      if (!this.url) this.url = url.replace(/["']/g, '')
      if (!this.headers) this.headers = headers
      if (!this.body) this.body = body?.data
      if (!this.query) this.query = query
    }
    if (this.benchmark?.wrk) {
      this._benchmark = new Wrk()
      this._benchmark.init(this.benchmark?.wrk)
    }
    if (!this.baseURL) this.baseURL = ''
    if (!this.url) this.url = ''
    if (!this.debug) this.debug = this.tc?.debug
    if (!this.method) this.method = Method.GET
    if (!this.headers) this.headers = {}
    this.headers = merge({ 'content-type': 'application/json' }, this.headers)
  }

  async prepare() {
    this._axiosData = {} as any
    if (this.docs) {
      this.docs = this.replaceVars(this.docs, this.getReplaceVarsContext())
    }
    // Merge and handle query string
    const [url, queries = ''] = this.url.split('?')
    this._axiosData.url = url

    this.query = Object.assign(parse(queries), this.query)
    if (this.query) {
      const docs = getDocType(this.query)
      if (this.docs) {
        if (!this.docs) this.docs = {}
        if (!this.docs.query) this.docs.query = {}
        mergeWith(this.docs.query, docs, (target, src) => {
          if (Array.isArray(target)) {
            return Array.from(new Set([...target, ...src]))
          }
        })
      }
    }

    if (this.headers) {
      const docs = getDocType(this.headers)
      if (this.docs) {
        if (!this.docs) this.docs = {}
        if (!this.docs.headers) this.docs.headers = {}
        mergeWith(this.docs.headers, docs, (target, src) => {
          if (Array.isArray(target)) {
            return Array.from(new Set([...target, ...src]))
          }
        })
      }
    }

    if (this.params) {
      for (const _k in this.params) {
        const vl = this.params[_k]
        const k = _k.replace(/\*/g, '')
        this.params[k] = vl
      }
      this._axiosData.url = this._axiosData.url
        .replace(/\*/g, '')
        .replace(/([^\$]){([^}]+)}/g, `$1$\{$.params.$2\}`)
      const varContext = this.getReplaceVarsContext()
      this._axiosData = this.replaceVars(this._axiosData, varContext)

      const docs = getDocType(this.params)
      if (this.docs) {
        if (!this.docs) this.docs = {}
        if (!this.docs.params) this.docs.params = {}
        mergeWith(this.docs.params, docs, (target, src) => {
          if (Array.isArray(target)) {
            return Array.from(new Set([...target, ...src]))
          }
        })
      }
    }

    if (this.body) {
      const docs = getDocType(this.body)
      if (this.docs) {
        if (!this.docs) this.docs = {}
        if (!this.docs.body) this.docs.body = {}
        mergeWith(this.docs.body, docs, (target, src) => {
          if (Array.isArray(target)) {
            return Array.from(new Set([...target, ...src]))
          }
        })
      }
    }

    super.prepare(undefined, Api.ignores)
    const self = this

    // this.$url = new URL(this, this.url, cloneDeep(this.params), cloneDeep(this.query))
    // await this.$url.prepare()
    // this.url = this.$url.url

    if (this.validate) {
      this.validate = this.validate.filter(v => v).map(v => {
        let vl = new Validate()
        if (v['Status']) {
          vl.init({
            title: 'Response status',
            func: Array.isArray(v['Status']) ? 'in' : 'match',
            args: ['${$.response.status}', v['Status']]
          })
        } else if (v['StatusText']) {
          vl.init({
            title: 'Response status text',
            func: 'match',
            args: ['${$.response.statusText}', v['StatusText']]
          })
        } else {
          vl.init(v)
        }
        return vl
      })
    }
    if (this._benchmark) {
      this._benchmark.$$ = this as any
      this._benchmark.tc = this.tc
    }
    this._controller = axios.CancelToken.source();
    this._axios = axios.create({
      cancelToken: this._controller.token,
      maxRedirects: 0,
      withCredentials: true,
      timeout: this.timeout,
      validateStatus: status => !!status
    })
    this._axiosData = {
      url: this._axiosData.url,
      method: this.method,
      baseURL: this.baseURL,
      get fullUrl() {
        return `${self.baseURL}${this.url}`
      },
      fullPathQuery(isEncode: boolean) {
        const q = stringify(self.query as any, undefined, undefined, isEncode ? undefined : { encodeURIComponent: str => str })
        return `${this.url}${q ? `?${q}` : ''}`
      },
      fullUrlQuery(isEncode: boolean) {
        return `${self.baseURL}${this.fullPathQuery(isEncode)}`
      },
      params: this.query,
      headers: this.headers,
      get contentType() {
        return this.headers['content-type'] || this.headers['Content-Type']
      }
    }
    if (this.isSupportBody) {
      if (this.body) {
        if (this._axiosData.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          this._axiosData.data = new URLSearchParams()
          for (let k in this.body) {
            this._axiosData.data.append(k, this.body[k])
          }
        } else if (this._axiosData.headers['content-type']?.includes('multipart/form-data')) {
          const FormData = require('form-data')
          this._axiosData.data = new FormData()
          for (let k in this.body) {
            this._axiosData.data.append(k, this.body[k])
          }
          merge(this._axiosData.headers, this._axiosData.data.getHeaders())
        } else {
          this._axiosData.data = this.body
        }
      }
    }
  }

  async validates() {
    this.validate = this.validate.filter(v => v)
    for (const v of this.validate) {
      if (this.depends) {
        v.description = `${this.docs ? chalk.yellow('★ ') : ''}${this.method.toString()} ${this._axiosData.fullUrl}`
        if (this.title) {
          v.slient = true
        }
      }
      if (v.slient === undefined) v.slient = this.slient
      v.tc = this.tc
      await v.prepare(this)
      if (!v.disabled) {
        this.error = await v.exec()
      }
      if (this.error) {
        this.tc.result.failed++
        return
      }
    }
    this.tc.result.passed++
  }

  stop() {
    this._controller?.cancel()
    this._benchmark?.stop()
  }

  private async download(req: any) {
    this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    const res = await this._axios.request({ ...req, responseType: 'stream' })
    const { createWriteStream } = require('fs')
    const writer = createWriteStream(this.saveTo);
    res.data.pipe(writer);
    return new Promise<AxiosResponse>((resolve, reject) => {
      writer.on('finish', () => {
        resolve(res)
      })
      writer.on('error', reject)
    })
  }

  get isSupportBody() {
    return ![Method.GET, Method.HEAD].includes(this.method)
  }

  get hasQuery() {
    return Object.keys(this.query || {}).length > 0
  }

  get hasParams() {
    return Object.keys(this.params || {}).length > 0
  }

  get hasHeaders() {
    return Object.keys(this.headers || {}).length > 0
  }

  async exec() {
    // const req = { ...this as any, url: this._url, params: Query.ToValue(this.url.query), data: this.body }
    // Listen to force stop
    context.once('app:stop', async () => {
      await this.stop()
    })

    // Run benchmark
    if (this._benchmark) {
      this._benchmark.bodyData = this._axiosData.data
      this.isRunBenchmark = true
      await this._benchmark.prepare()
      await this._benchmark.exec()
      return
    }

    // Call API
    this.index = ++Api.Index
    const begin = Date.now()
    try {
      context.emit('log:api:begin', this)
      let data: any
      if (this.saveTo) {
        this._axiosData.responseType = 'stream'
      }
      if (!this.response) {
        const res = this.saveTo ? await this.download(this._axiosData) : await this._axios.request(this._axiosData)
        data = res.data
        this.response = {
          ok: null,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          data,
        }
      }
      this.response.ok = this.response.status >= 200 && this.response.status < 300
    } catch (error: Error & any) {
      const { status, statusText, config = {}, response = {} } = error
      const { url, method, headers, params, baseURL, timeout, withCredentials, fullUrl, contentType, data } = config
      this.error = { status, statusText }
      this.error.config = { url, method, headers, params, baseURL, timeout, withCredentials, fullUrl, contentType, data }
      this.error.response = { headers: response.headers, data: response.data }
      this.error.message = this.error.response?.data || error?.message
    } finally {
      this.time = Date.now() - begin
      context.emit('log:api:done', this)
      if (this.var) this.setVar(this.var, this.response?.data)
      if (!this.error) {
        if (this.validate) {
          await this.validates()
          context.emit('log:api:validate:done', this)
        }
      }
      context.emit('log:api:end', this)
      Testcase.APIs.push(this)
    }
  }

  toTestObject(baseURL?: string) {
    const self = this
    const item = {
      id: this.index,
      name: this.title,
      method: this.method.toString(),
      baseURL: (baseURL || this.baseURL),
      baseURLs: Object.keys(this.tc.servers).map(des => {
        return {
          description: `${des} - ${this.tc.servers[des]}`,
          url: this.tc.servers[des]
        }
      }),
      url: this._axiosData.fullPathQuery(false),
      headers: this.headers,
      cate: this.tc.title,
      body: {
        text: undefined,
        json: {},
        form: {},
        multipart: {}
      },
      get error() {
        return !(this.response?.status >= 200 && this.response?.status < 400)
      },
      // note: this.docs.md?.note,
      response: { error: self.error, ...this.response, executionTime: this.time } as any,
      contentType: this._axiosData.contentType || 'application/json',
    }
    if (item.response && Array.isArray(item.response.data)) {
      item.response.data = item.response.data.slice(0, 1)
    }
    if (item.contentType.includes('application/json')) {
      item.headers['content-type'] = 'application/json'
      if (this.body) item.body.json = this.body
    } else if (item.contentType.includes('multipart/form-data')) {
      item.headers['content-type'] = 'multipart/form-data'
      item.body.multipart = this.body || {}
    } else if (item.contentType.includes('text/plain')) {
      item.headers['content-type'] = 'text/plain'
      if (this.body) item.body.text = this.body
    } else {
      item.headers['content-type'] = 'application/x-www-form-urlencoded'
      item.body.form = this.body || {}
    }
    return item
  }

  toTestAPI6() {
    const defaultBaseURL = Object.keys(this.tc.servers || {})[0]
    return JSON.parse(JSON.stringify({
      title: this.title,
      debug: 'details',
      baseURL: defaultBaseURL ? `\$\{${defaultBaseURL}\}` : this.baseURL,
      url: this.url,
      params: this.params && Object.keys(this.params).length ? this.params : undefined,
      headers: this.headers && Object.keys(this.headers).length ? this.headers : undefined,
      query: this.query && Object.keys(this.query).length ? this.query : undefined,
      body: this.body
    }))
  }

  toCUrl() {
    const { CurlGenerator } = require('curl-generator')
    return CurlGenerator({
      method: this.method as any,
      headers: Object.keys(this.headers || {}).reduce((sum, e) => {
        sum[e] = (this.headers[e] || '').toString()
        return sum
      }, {}),
      body: this.body,
      url: this._axiosData.fullUrlQuery(true)
    })
  }

  logDetails() {
    const obj = this._axiosData
    const space = '--------------------------------------'
    if (['details', 'request'].includes(this.debug as string)) {
      context.log(`${chalk.red('%s')}`, obj.method + ' ' + obj.fullUrlQuery(false))
      // Request header
      const reqHeaders = Object.keys(obj.headers)
      if (reqHeaders.length) {
        context.log(chalk.gray('%s'), space)
        reqHeaders.forEach(k => context.log(chalk.redBright.italic(`• ${k}: ${obj.headers[k]}`)))
      }
      // Request body
      if (obj.data) {
        context.log(chalk.gray('%s'), space)
        context.log(obj.data)
      }
      context.log('')
    }
    if (['details', 'response'].includes(this.debug as string) && this.response) {
      const res = this.response
      context.log(chalk.green('%s'), `RESPONSE - ${res.status} ${res.statusText}`)
      // Response headers
      const resHeaders = Object.keys(res.headers)
      if (resHeaders.length > 0) {
        context.log(chalk.gray('%s'), space)
        resHeaders.forEach(k => context.log(chalk.greenBright.italic(`• ${k}: ${res.headers[k]}`)))
      }
      // Response data
      if (res.data) {
        context.log(chalk.gray('%s'), space)
        context.log(res.data)
      }
      context.log('')
    }
  }

  toTestLink(link?: string) {
    const item = this.toTestObject(link)
    const sdatas = deflateSync(JSON.stringify(item), { level: 9 }).toString('base64')
    const links = `http://test.onapis.com/Test/${sdatas}`
    return links
  }

  static toImportLink(items: any[]) {
    const sdatas = deflateSync(JSON.stringify(items), { level: 9 }).toString('base64')
    const links = `http://test.onapis.com/Test/${sdatas}`
    return links
  }
}
import { Tag } from "../Tag"
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, CancelTokenSource } from 'axios'
import { merge, pick } from 'lodash'
import { stringify } from 'querystring'
import { Testcase } from "../Testcase"
import chalk from 'chalk'
import { Validate } from "../data_handler/Validate"
import FormData from 'form-data'
import { URLSearchParams } from "url"
import pako from 'pako'
import { context } from '../../Context'
import { Wrk, IWrk } from "../benchmark/Wrk"
import { Operation } from "../doc/OpenAPI3"
import { createWriteStream } from "fs"
import { CURLParser } from 'parse-curl-js'
import { CurlGenerator } from "curl-generator";
import { parse } from 'querystring'

context
  .on('log:api:begin', (api: Api) => {
    if (!api.slient) {
      context.log(`${chalk.gray('%s')}. %s\t${chalk.gray.underline('%s %s')}`, api.index.toString(), api.title, api.method.toString(), api._axiosData.fullUrlQuery)
    }
  })
  .on('log:api:validate:done', (_api: Api) => {
    // Validate done
  })
  .on('log:api:done', (api: Api) => {
    if (!api.slient) {
      context.log(`${chalk.gray('<=')} ${chalk[api.response?.ok ? 'green' : 'red'].bold('%s')} ${chalk.gray('%s')} ${chalk.gray.italic('%s')}`, api.response?.status.toString(), api.response?.statusText, ` (${api.time.toString()}ms)`)
    }
  })
  .on('log:api:end', (api: Api) => {
    if (api.debug === 'curl') {
      context.log('')
      context.log(`${chalk.green('⬤')} ${chalk.gray.underline('%s')}`, api.toCUrl())
    } else if (['details', 'response', 'request'].includes(api.debug as string)) {
      const [req, res] = api.toDetails()
      context.log('')
      req.forEach(line => context.log('%s', chalk.magenta(`${line}`)))
      res.forEach(line => context.log('%s', chalk.green(`${line}`)))
    }
    if (api.debug === true || api.error) {
      context.log('')
      context.log(`${chalk.red('⬤')} ${chalk.underline.gray('%s')}`, api.toTestLink())
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

export class Query {
  constructor(public name: string, public value: any, public required: boolean) { }

  static ToValue(qs: { [key: string]: Query }) {
    return Object.keys(qs).reduce((sum, e) => {
      sum[e] = qs[e].value
      return sum
    }, {})
  }
}

export class URL {
  private static PT = /([^\$]){([^}]+)}/g

  constructor(public $: Api, public url: string, public params = {} as { [key: string]: Query }, public query = {} as { [key: string]: Query }) {
    for (const _k in this.params) {
      const vl = this.params[_k]
      let required = _k.includes('*')
      const k = _k.replace(/\*/g, '')
      this.params[k] = new Query(k, vl, required)
      if (required) delete this.params[_k]
    }

    this.url = url.replace(/\*/g, '').replace(URL.PT, `$1$\{_params.$2\}`)
  }

  async prepare() {
    this.url = this.$.replaceVars(this.url, { _params: this.toParams() }, undefined)
    this.url = this.$.replaceVars(this.url, { ...context.Vars, Vars: context.Vars, $: this.$, $$: this.$.$$, Utils: context.Utils, Result: context.Result }, undefined)

    const [_url, queries = ''] = this.url.split('?')
    this.url = _url

    const q = merge({}, parse(queries), this.query)
    for (const _k in q) {
      const vl = q[_k]
      const required = _k.includes('*')
      const k = _k.replace(/\*/g, '')
      this.query[k] = new Query(k, vl, required)
      if (required) delete this.query[_k]
    }
  }

  toQuery() {
    const rs = Object.keys(this.query || {}).reduce((sum, k) => {
      sum[k] = this.query[k].value
      return sum
    }, {})
    return rs
  }

  toParams() {
    const rs = Object.keys(this.params || {}).reduce((sum, k) => {
      sum[k] = this.params[k].value
      return sum
    }, {})
    return rs
  }

  getUrlJoinQuery() {
    if (Object.keys(this.query || {}).length) {
      return `${this.url}?${stringify(this.$.query as any)}`
    }
    return this.url
  }
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
  /** Set global variables */
  vars: object
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
  $url: URL
  /** Validate after request done */
  validate: Validate[]

  /** Generate to document */
  docs?: {
    /** Only doc these request headers */
    headers?: string[]
    /** Only doc these response headers */
    responseHeaders?: string[]
    /** Config for markdown document */
    md?: {
      /** Group API document */
      tags?: string[]
    }
    /** Config for swagger document */
    swagger?: Operation
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
    readonly fullUrlQuery: string
    readonly contentType: string
  }
  _axios: AxiosInstance
  _controller: CancelTokenSource
  _benchmark?: Wrk
  isRunBenchmark: boolean

  constructor(attrs: Api) {
    super(attrs)
    if (this.curl) {
      const meta = new CURLParser(this.curl).parse()
      const { method, url, headers, query, body } = meta
      merge({
        method: method.toUpperCase(),
        url: url.replace(/["']/g, ''),
        headers: headers,
        body: body?.data,
        query: query
      }, this)
    }
    merge(this, merge({ headers: {} }, this))
    if (this.benchmark?.wrk) {
      this._benchmark = new Wrk(this.benchmark?.wrk)
    }
    if (!this.baseURL) this.baseURL = ''
    if (!this.url) this.url = ''
    if (!this.debug) this.debug = this.tc?.debug
    if (!this.method) this.method = Method.GET
  }

  async prepare() {
    super.prepare(undefined, ['validate', 'var', '_benchmark', 'docs', '_controller', '_axios'])
    const self = this
    this.$url = new URL(this, this.url, this.params, this.query)
    await this.$url.prepare()
    // this.url = this.$url.url
    this.query = this.$url.toQuery()
    this.params = this.$url.toParams()
    if (this.validate) {
      this.validate = this.validate.filter(v => v).map(v => {
        if (v['Status']) {
          return new Validate({
            title: 'Response status',
            func: Array.isArray(v['Status']) ? 'in' : 'match',
            args: ['${$.response.status}', v['Status']]
          })
        } else if (v['StatusText']) {
          return new Validate({
            title: 'Response status text',
            func: 'match',
            args: ['${$.response.statusText}', v['StatusText']]
          })
        }
        return new Validate(v)
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
      method: this.method,
      baseURL: this.baseURL,
      url: this.$url.url,
      get fullUrlQuery() {
        return `${this.baseURL}${self.$url.getUrlJoinQuery()}`
      },
      params: this.query,
      headers: merge({ 'content-type': 'application/json' }, this.headers),
      get contentType() {
        return this.headers['content-type'] || this.headers['Content-Type']
      }
    } as any
    if (this.isSupportBody) {
      if (this.body) {
        if (this._axiosData.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
          this._axiosData.data = new URLSearchParams()
          for (let k in this.body) {
            this._axiosData.data.append(k, this.body[k])
          }
        } else if (this._axiosData.headers['content-type']?.includes('multipart/form-data')) {
          this._axiosData.data = new FormData()
          for (let k in this.body) {
            this._axiosData.data.append(k, this.body[k])
          }
          this._axiosData.headers = merge({}, this._axiosData.headers, this._axiosData.data.getHeaders())
        } else {
          this._axiosData.data = this.body
        }
      }
    }
  }

  async validates() {
    for (const v of this.validate.filter(v => v)) {
      v.slient = this.slient
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
      const res = this.saveTo ? await this.download(this._axiosData) : await this._axios.request(this._axiosData)
      data = res.data
      this.response = {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        data,
      }
      if (this.docs) {
        this.docs = this.replaceVars(this.docs, { ...context.Vars, Vars: context.Vars, $: this, $$: this.$$, Utils: context.Utils, Result: context.Result })
      }
      // if (this.vars) {
      //   for (let k in this.vars) {
      //     context.Vars[k] = res[k]
      //   }
      // }
    } catch (err) {
      err = pick(err, 'config', 'response', 'status', 'statusText')
      if (err.config) {
        err.config = pick(err.config, 'url', 'method', 'headers', 'params', 'baseURL', 'timeout', 'withCredentials', 'fullUrl', 'contentType', 'data')
      }
      if (err.request) {
        delete err.request
      }
      if (err.response) {
        err.response = pick(err.response, 'headers', 'data')
      }
      this.error = err
    } finally {
      this.time = Date.now() - begin
      context.emit('log:api:done', this)
      if (this.var) this.setVar(this.var, this.response.data)
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
      url: this._axiosData.url,
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
      response: { error: this.error, ...this.response, executionTime: this.time } as any,
      contentType: this.headers['content-type'] || 'application/json',
    }
    if (item.response && Array.isArray(item.response.data)) {
      item.response.data = item.response.data.slice(0, 1)
    }
    if (item.contentType.includes('application/json')) {
      item.headers['content-type'] = 'application/json'
    } else if (item.contentType.includes('multipart/form-data')) {
      item.headers['content-type'] = 'multipart/form-data'
    } else if (item.contentType.includes('text/plain')) {
      item.headers['content-type'] = 'text/plain'
    } else {
      item.headers['content-type'] = 'application/x-www-form-urlencoded'
    }
    if (item.contentType === 'application/json') {
      if (this.body) item.body.json = this.body
    } else if (item.contentType === 'text/plain') {
      if (this.body) item.body.text = this.body
    } else if (item.contentType === 'multipart/form-data') {
      item.body.multipart = this.body || {}
    } else {
      item.body.form = this.body || {}
    }
    return item
  }

  toCUrl() {
    return CurlGenerator({
      method: this.method as any,
      headers: Object.keys(this.headers || {}).reduce((sum, e) => {
        sum[e] = (this.headers[e] || '').toString()
        return sum
      }, {}),
      body: this.body,
      url: this._axiosData.fullUrlQuery
    })
  }

  toDetails() {
    const obj = this._axiosData
    const msgReq = []
    const space = chalk.gray('---------------------------------------')
    if (['details', 'request'].includes(this.debug as string)) {
      msgReq.push(`${chalk.bold(obj.method + ' ' + obj.fullUrlQuery)}`)
      // Request header
      const reqHeaders = Object.keys(obj.headers)
      if (reqHeaders.length) {
        msgReq.push(space)
        reqHeaders.forEach(k => msgReq.push(chalk.italic(`• ${k}: ${obj.headers[k]}`)))
      }
      // Request body
      if (obj.data) {
        msgReq.push(space)
        msgReq.push(...JSON.stringify(obj.data, null, '  ').split('\n'))
      }
      msgReq.push('')
    }
    const msgRes = []
    if (['details', 'response'].includes(this.debug as string) && this.response) {
      const res = this.response
      msgRes.push(chalk.bold(`${res.status} ${res.statusText}`))
      // Response headers
      const resHeaders = Object.keys(res.headers)
      if (resHeaders.length > 0) {
        msgRes.push(space)
        resHeaders.forEach(k => msgRes.push(chalk.italic(`• ${k}: ${res.headers[k]}`)))
      }
      // Response data
      if (res.data) {
        msgRes.push(space)
        if (typeof res.data === 'object') {
          msgRes.push(...JSON.stringify(res.data, null, '  ').split('\n'))
        } else if (typeof res.data === 'string') {
          msgRes.push(...res.data.split('\n'))
        } else {
          msgRes.push(res.data)
        }
      }
      msgRes.push('')
    }
    return [msgReq, msgRes]
  }

  toTestLink(link?: string) {
    const item = this.toTestObject(link)

    const str = pako.deflate(JSON.stringify(item), { level: 9 });
    const sdatas = Buffer.from(str).toString('base64')
    const links = `http://test.onapis.com/Test/${sdatas}`
    return links
  }

  static toImportLink(items: any[]) {
    const str = pako.deflate(JSON.stringify(items), { level: 9 });
    const sdatas = Buffer.from(str).toString('base64')
    const links = `http://test.onapis.com/Test/${sdatas}`
    return links
  }
}
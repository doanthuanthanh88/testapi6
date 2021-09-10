import { Api } from '@/components/api/Api'
import { isGotData, toJsonSchema } from '@/components/doc/DocUtils'
import { OpenAPI } from '@/components/doc/OpenAPI3'
import { OutputFile } from '@/components/output/OutputFile'
import { Testcase } from '@/components/Testcase'
import { readFileSync } from 'fs'
import { dump, load } from 'js-yaml'
import { cloneDeep, merge, uniqBy } from 'lodash'
import { Tag } from '../Tag'
import { RefSchema } from './RefSchema'
import { Swagger2Markdown } from './Swagger2Markdown'

const jsonSchemaOptions = undefined

/**
 * Export document to specific formats
 * 
 * ```yaml
 * - DocOpenAPI:
 *    saveTo: test.swagger.yaml             # Swagger ouput file
 *      swagger: ./api-document.yaml
 *      markdown: ./api-document.md
 *    headers: []                           # Only expose these request headers
 *    responseHeaders: ["content-type"]     # Only expose these response headers
 *    openapi:                              # Overide OpenAPI properties
 *      components:
 *        securitySchemes:
 *          bearerAuth:
 *            type: http
 *            scheme: bearer
 *            bearerFormat: JWT
 *          bypassAuth:
 *            type: apiKey
 *            name: keyHere
 *            description: ...
 *            in: header
 *          bypassAuthHeader:
 *            type: apiKey
 *            name: valueHere
 *            description: ...
 *            in: header
 * ```
 */
export class DocOpenAPI extends Tag {
  saveTo: {
    swagger?: string
    markdown?: string
  }
  /** Convert swagger file to anothers */
  src?: string
  /** Only doc these request headers */
  allowHeaders: string[]
  /** Only doc these response headers */
  allowResponseHeaders: string[]
  /** Overide OpenAPI properties which system generated */
  openapi: OpenAPI

  init(attr, ...args) {
    if (attr.saveTo?.markdown) {
      attr.saveTo.markdown = Testcase.getPathFromRoot(attr.saveTo.markdown.trim())
    }
    if (attr.saveTo?.swagger) {
      attr.saveTo.swagger = Testcase.getPathFromRoot(attr.saveTo.swagger.trim())
    }
    super.init(attr, ...args)
    if (this.src) {
      this.openapi = merge({}, load(readFileSync(Testcase.getPathFromRoot(this.src)).toString()), this.openapi)
    } else {
      this.src = 'self.doc.openapi.tmp'
    }
  }

  async exec() {
    if (!this.saveTo) return
    const self = this
    let tags = this.openapi.tags || []
    const cnt = merge({
      openapi: '3.0.1',
      info: {
        title: self.tc.title || '',
        description: `${self.tc.description || ''}`,
        version: self.tc.version || '',
        contact: {
          name: self.tc.developer?.split('@')[0] || '',
          email: self.tc.developer || ''
        }
      },
      externalDocs: {
        description: `Updated At: ${new Date().toString()}`,
        url: 'https://'
      },
      servers: Object.keys(self.tc.servers || {}).map(des => {
        return {
          url: self.tc.servers[des],
          description: des
        }
      }),
      tags,
      paths: {},
      components: {
        schemas: {}
      }
    }, this.openapi)
    let apis = [] as Api[]
    if (this.src === 'self.doc.openapi.tmp') {
      apis = uniqBy(Testcase.APIs.filter(api => api.docs && api.title), e => `${e.method.toLowerCase()} ${e.url}`)
    } else {
      Object.entries(this.openapi.paths).forEach(([pathName, path]) => {
        Object.entries(path).forEach(([method, api]) => {
          const a = new Api()
          a.init({
            method: method?.toUpperCase(),
            url: pathName,
            docs: {
              openapi: api
            }
          } as any)
          apis.push(a)
        })
      })
    }

    for (const api of apis) {
      const yamlAPI = api.docs.openapi
      const isRefApi = yamlAPI.$ref
      if (isRefApi) {
        RefSchema.scan(Testcase.getPathFromRoot(this.src), yamlAPI, undefined, false)
        merge(yamlAPI, api.docs.openapi)
      }

      // Handle default
      let _tags = [...(api.docs.openapi?.tags || []), ...(api.docs.tags || [])]
      if (_tags && _tags.length) {
        const newTags = _tags.map(e => {
          return typeof e === 'string' ? { name: e } : e as { name: string }
        }).filter(tag => !tags.find(t => t.name?.toLowerCase() === tag.name?.toLowerCase()))
        tags.push(...newTags)
      }
      const pathName = api.url //(api.docs.pathname || api._url)
      if (!cnt.paths[pathName]) cnt.paths[pathName] = {}
      const method = api.method.toString().toLowerCase()
      const rs = {
        summary: api.title || '',
        description: api.description || '',
        example: api._axiosData?.fullUrl || pathName,
        parameters: [],
        ...api.docs?.openapi,
        tags: _tags || [],
      } as any
      cnt.paths[pathName][method] = rs
      if (api.docs.deprecated !== undefined) rs.deprecated = api.docs.deprecated

      if (isRefApi) {
        api.params = api.query = api.headers = {}
        api.body = undefined
        if (api.response) {
          api.response.headers = {}
          api.response.data = undefined
        }
      }
      // Request params
      let keys = Object.keys(api.params || {})
      // if (keys.length) {
      if (api.docs?.params) {
        RefSchema.scan(Testcase.getPathFromRoot(this.src), api.docs?.params, undefined, false)
      }
      keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.params?.properties || {})]))
      for (const name of keys) {
        let old = rs.parameters?.find(e => e.name === name && e.in === 'path')
        if (!old) {
          old = {
            in: 'path',
            name: name,
            required: true,
            // style: 'form',
            // explode: true,
            schema: toJsonSchema(api.params[name], true, jsonSchemaOptions)
          }
          rs.parameters.push(old)
        }
        if (api.docs?.params) {
          // if (api.docs.params.required) old.required = api.docs.params.required.includes(name)
          // else if (Array.isArray(old.required)) delete old.required
          if (api.docs.params.properties && api.docs.params.properties[name]) {
            const { description, ...props } = api.docs.params.properties[name]
            if (description) old.description = description
            if (!props.example && api.params[name] !== undefined) props.example = api.params[name]
            merge(old, { schema: props })
          }
        }
      }
      // }

      // Request query
      keys = Object.keys(api.query || {}).filter(e => api.query[e])
      // if (keys.length) {
      if (api.docs?.query) {
        RefSchema.scan(Testcase.getPathFromRoot(this.src), api.docs?.query, undefined, false)
      }
      keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.query?.properties || {})]))
      for (const name of keys) {
        let old = rs.parameters?.find(e => e.name === name && e.in === 'query')
        if (!old) {
          old = {
            in: 'query',
            name: name,
            // style: 'form',
            // explode: true,
            schema: toJsonSchema(api.query[name], true, jsonSchemaOptions)
          }
          rs.parameters.push(old)
        }
        if (api.docs?.query) {
          if (api.docs.query.required) old.required = api.docs.query.required.includes(name)
          else if (Array.isArray(old.required)) delete old.required
          if (api.docs.query.properties && api.docs.query.properties[name]) {
            const { description, ...props } = api.docs.query.properties[name]
            if (description) old.description = description
            if (!props.example && api.query[name] !== undefined) props.example = api.query[name]
            merge(old, { schema: props })
          }
        }
      }
      // }

      // Request headers
      keys = Object.keys(api.headers)
      if (this.allowHeaders) {
        keys = keys.filter(e => this.allowHeaders.includes(e) && api.headers[e] !== undefined)
      }
      // if (keys.length) {
      if (api.docs?.headers) {
        RefSchema.scan(Testcase.getPathFromRoot(this.src), api.docs?.headers, undefined, false)
      }
      keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.headers?.properties || {})]))
      for (const name of keys) {
        let old = rs.parameters?.find(e => e.name === name && e.in === 'header')
        if (!old) {
          old = {
            in: 'header',
            name: name,
            // style: 'form',
            // explode: true,
            schema: toJsonSchema(api.headers[name], true, jsonSchemaOptions)
          }
          rs.parameters.push(old)
        }
        if (api.docs?.headers) {
          if (api.docs.headers.required) old.required = api.docs.headers.required.includes(name)
          else if (Array.isArray(old.required)) delete old.required
          if (api.docs.headers.properties && api.docs.headers.properties[name]) {
            const { description, ...props } = api.docs.headers.properties[name]
            if (description) old.description = description
            if (!props.example && api.headers[name] !== undefined) props.example = api.headers[name]
            merge(old, { schema: props })
          }
        }
      }
      // }
      // Request body
      if (isGotData(api.body) || api.docs.body) {
        if (api.docs.body) {
          RefSchema.scan(Testcase.getPathFromRoot(this.src), api.docs.body, undefined, false)
        }
        const schema = {
          schema: merge(api.body ? toJsonSchema(api.body, false, jsonSchemaOptions) : {}, api.docs.body || {})
        } as any
        if (api.body !== undefined) {
          schema.example = api.body
        }
        const type = Object.keys((rs.requestBody || {}).content || {})[0] || 'application/json'
        const old = {
          content: {
            [type]: schema
          }
        }
        rs.requestBody = merge({}, old, rs.requestBody || {})
      }

      // Response
      if (isGotData(api.response) || api.docs.data || api.docs.responseHeaders) {
        rs.responses = merge({}, {
          [api.response.status]: {
            description: api.response.statusText || ''
          }
        }, rs.responses || {})

        // Response data
        if (isGotData(api.response.data, false) || api.docs.data) {
          let [contentType = ''] = api.response.headers['content-type']?.split(';')
          contentType = contentType.trim()
          if (api.docs?.data) {
            RefSchema.scan(Testcase.getPathFromRoot(this.src), api.docs?.data, undefined, false)
          }
          const schema = {
            schema: merge(api.response.data ? toJsonSchema(api.response.data, true, jsonSchemaOptions) : {}, api.docs.data || {})
          } as any
          if (api.response.data !== undefined) schema.example = api.response.data
          rs.responses = merge({
            [api.response.status]: {
              content: {
                [contentType]: schema
              }
            }
          }, rs.responses)
        }

        // Response headers
        keys = Object.keys(api.response.headers)
        if (this.allowResponseHeaders) {
          keys = keys.filter(e => this.allowResponseHeaders.includes(e))
        }
        keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.responseHeaders?.properties || {})]))
        if (!rs.responses[api.response.status].headers) rs.responses[api.response.status].headers = {}
        for (const name of keys) {
          if (!rs.responses[api.response.status].headers[name]) rs.responses[api.response.status].headers[name] = {}
          let old = rs.responses[api.response.status].headers[name]
          old.schema = toJsonSchema(api.response.headers[name], true, jsonSchemaOptions)
          if (api.docs?.responseHeaders) {
            if (api.docs.responseHeaders.required) old.required = api.docs.responseHeaders.required.includes(name)
            if (api.docs.responseHeaders.properties && api.docs.responseHeaders.properties[name]) {
              const { description, ...props } = api.docs.responseHeaders.properties[name]
              if (description) old.description = description
              merge(old, { schema: props })
            }
          }
          RefSchema.scan(Testcase.getPathFromRoot(this.src), old.schema, undefined, false)
        }
      }

      rs.parameters?.forEach(p => {
        if (p?.schema) RefSchema.scan(Testcase.getPathFromRoot(this.src), p.schema, undefined, true)
      })

      Object.entries(rs.requestBody || {}).forEach(([_, content]) => {
        Object.entries(content['content'] || {}).forEach(([_, schema]) => {
          if (schema && schema['schema']) RefSchema.scan(Testcase.getPathFromRoot(this.src), schema['schema'], undefined, true)
        })
      })

      Object.entries(rs.responses || {}).forEach(([_, content]) => {
        Object.entries(content['headers'] || {}).forEach(([_, schema]) => {
          if (schema && schema['schema']) RefSchema.scan(Testcase.getPathFromRoot(this.src), schema['schema'], undefined, true)
        })
        Object.entries(content['content'] || {}).forEach(([_, schema]) => {
          if (schema && schema['schema']) RefSchema.scan(Testcase.getPathFromRoot(this.src), schema['schema'], undefined, true)
        })
      })
    }
    cnt.tags = tags

    Object.entries(RefSchema.ownerRefs).forEach(([typeName, schemaData]) => {
      if (!cnt.components.schemas[typeName]) {
        cnt.components.schemas[typeName] = schemaData
      }
    })

    Tag.cleanDelObject(cnt)

    await Promise.all([
      !this.saveTo.markdown ? Promise.resolve() : (async (openAPIObject: any) => {
        this.saveTo.markdown = this.saveTo.markdown.trim()
        const swaggerToMD = new Swagger2Markdown(openAPIObject, this.saveTo.markdown)
        const output = new OutputFile()
        output.init({
          title: 'Export document to markdown format',
          content: swaggerToMD.getMarkdown(),
          saveTo: swaggerToMD.saveTo
        })
        await output.save()
      })(cloneDeep(cnt)),
      !this.saveTo.swagger ? Promise.resolve() : (async (openAPIObject) => {
        this.saveTo.swagger = this.saveTo.swagger.trim()
        // Clean openapi content
        Object.entries<any>(openAPIObject.paths || {}).forEach(([, _path = {}]) => {
          Object.entries<any>(_path).forEach(([, method = {}]) => {
            delete method.example
            Object.entries<any>(method.responses || {}).forEach(([, code = {}]) => {
              Object.entries<any>(code.content || {}).forEach(([, contentType = {}]) => {
                delete contentType.example
                delete contentType.schema?.example
              })
            })
          })
        })
        const output = new OutputFile()
        output.init({
          title: 'Export document to swagger format',
          content: dump(openAPIObject),
          saveTo: this.saveTo.swagger
        })
        await output.save()
      })(cloneDeep(cnt)),
    ])
  }
}

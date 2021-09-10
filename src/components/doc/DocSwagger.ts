import { isGotData, toJsonSchema } from '@/components/doc/DocUtils'
import { OpenAPI } from '@/components/doc/OpenAPI3'
import { OutputFile } from '@/components/output/OutputFile'
import { Testcase } from '@/components/Testcase'
import { dump } from 'js-yaml'
import { merge, uniqBy } from 'lodash'
import { basename, dirname, join } from 'path'
import { Tag } from '../Tag'
import { RefSchema } from './RefSchema'
import { Swagger2Markdown } from './Swagger2Markdown'

const jsonSchemaOptions = undefined

/**
 * Export swagger document
 * 
 * ```yaml
 * - DocSwagger:
 *    saveTo: test.swagger.yaml         # Swagger ouput file
 *    headers: []                       # Only expose these request headers
 *    responseHeaders: ["content-type"] # Only expose these response headers
 *    raw:                              # Overide OpenAPI properties
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
export class DocSwagger extends OutputFile {
  /** Only doc these request headers */
  allowHeaders: string[]
  /** Only doc these response headers */
  allowResponseHeaders: string[]
  /** Overide OpenAPI properties which system generated */
  raw: OpenAPI
  /** Auto convert swagger to markdown */
  convertToMarkdown: boolean

  async exec() {
    const self = this
    let tags = this.raw.tags || []
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
        description: `Last updated: ${new Date().toString()}`,
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
    }, this.raw)
    const apis = uniqBy(Testcase.APIs.filter(api => api.docs && api.title), e => `${e.method.toLowerCase()} ${e.url}`)

    for (const api of apis) {
      // Handle refs
      const isRefOthers = !!api.docs.swagger?.ref
      const yamlAPI = api.docs.swagger
      RefSchema.scan('', yamlAPI, undefined, true)
      api.docs.swagger = merge({}, yamlAPI, api.docs.swagger)

      // Handle default
      let _tags = [...(api.docs.swagger?.tags || []), ...(api.docs.tags || [])]
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
        example: api._axiosData.fullUrl,
        parameters: [],
        ...api.docs?.swagger,
        tags: _tags || [],
        // externalDocs: {
        //   description: 'Try now',
        //   url: tag.toTestLink()
        // }
      } as any
      cnt.paths[pathName][method] = rs
      if (api.docs.deprecated !== undefined) rs.deprecated = api.docs.deprecated

      if (!isRefOthers) {
        // Request params
        let keys = Object.keys(api.params || {})
        if (keys.length) {
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
                schema: toJsonSchema(api.params[name], jsonSchemaOptions)
              }
              rs.parameters.push(old)
            }
            if (api.docs?.params) {
              // if (api.docs.params.required) old.required = api.docs.params.required.includes(name)
              // else if (Array.isArray(old.required)) delete old.required
              if (api.docs.params.properties && api.docs.params.properties[name]) {
                const { description, ...swaggerProps } = api.docs.params.properties[name]
                if (description) old.description = description
                if (!swaggerProps.example && api.params[name] !== undefined) swaggerProps.example = api.params[name]
                merge(old, { schema: swaggerProps })
              }
            }
          }
        }

        // Request query
        keys = Object.keys(api.query || {})
        if (keys.length) {
          keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.query?.properties || {})]))
          for (const name of keys) {
            let old = rs.parameters?.find(e => e.name === name && e.in === 'query')
            if (!old) {
              old = {
                in: 'query',
                name: name,
                // style: 'form',
                // explode: true,
                schema: toJsonSchema(api.query[name], jsonSchemaOptions)
              }
              rs.parameters.push(old)
            }
            if (api.docs?.query) {
              if (api.docs.query.required) old.required = api.docs.query.required.includes(name)
              else if (Array.isArray(old.required)) delete old.required
              if (api.docs.query.properties && api.docs.query.properties[name]) {
                const { description, ...swaggerProps } = api.docs.query.properties[name]
                if (description) old.description = description
                if (!swaggerProps.example && api.query[name] !== undefined) swaggerProps.example = api.query[name]
                merge(old, { schema: swaggerProps })
              }
            }
          }
        }

        // Request headers
        keys = Object.keys(api.headers)
        if (this.allowHeaders) {
          keys = keys.filter(e => this.allowHeaders.includes(e))
        }
        if (keys.length) {
          keys = Array.from(new Set([...keys, ...Object.keys(api.docs?.headers?.properties || {})]))
          for (const name of keys) {
            let old = rs.parameters?.find(e => e.name === name && e.in === 'header')
            if (!old) {
              old = {
                in: 'header',
                name: name,
                // style: 'form',
                // explode: true,
                schema: toJsonSchema(api.headers[name], jsonSchemaOptions)
              }
              rs.parameters.push(old)
            }
            if (api.docs?.headers) {
              if (api.docs.headers.required) old.required = api.docs.headers.required.includes(name)
              else if (Array.isArray(old.required)) delete old.required
              if (api.docs.headers.properties && api.docs.headers.properties[name]) {
                const { description, ...swaggerProps } = api.docs.headers.properties[name]
                if (description) old.description = description
                if (!swaggerProps.example && api.headers[name] !== undefined) swaggerProps.example = api.headers[name]
                merge(old, { schema: swaggerProps })
              }
            }
          }
        }
        // Request body
        if (isGotData(api.body)) {
          const schema = {
            schema: merge(toJsonSchema(api.body, jsonSchemaOptions), api.docs.body || {})
          } as any
          if (api.body !== undefined) schema.example = api.body
          const old = {
            content: {
              'application/json': schema
            }
          }
          rs.requestBody = merge({}, old, rs.requestBody || {})
        }
        // Response
        if (isGotData(api.response)) {
          rs.responses = merge({}, {
            [api.response.status]: {
              description: api.response.statusText || ''
            }
          }, rs.responses || {})

          // Response data
          if (isGotData(api.response.data, false)) {
            let [contentType = ''] = api.response.headers['content-type']?.split(';')
            contentType = contentType.trim()
            const schema = {
              schema: merge(toJsonSchema(api.response.data, jsonSchemaOptions), api.docs.data || {})
            } as any
            if (api.response.data !== undefined) schema.example = api.response.data
            rs.responses = merge({}, {
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
            old.schema = toJsonSchema(api.response.headers[name], jsonSchemaOptions)
            if (api.docs?.responseHeaders) {
              if (api.docs.responseHeaders.required) old.required = api.docs.responseHeaders.required.includes(name)
              if (api.docs.responseHeaders.properties && api.docs.responseHeaders.properties[name]) {
                const { description, ...swaggerProps } = api.docs.responseHeaders.properties[name]
                if (description) old.description = description
                merge(old, { schema: swaggerProps })
              }
            }
          }
        }
      }
    }
    const swaggerObject = Tag.cleanObject(cnt)
    this.content = dump(swaggerObject)
    cnt.tags = tags
    if (!this.title) this.title = 'Swagger document'
    await this.save()
    if (this.convertToMarkdown) {
      const swaggerToMD = new Swagger2Markdown(swaggerObject, join(dirname(this.saveTo), basename(this.saveTo, 'yaml') + 'md'))
      const mdFile = new OutputFile()
      mdFile.init({
        content: swaggerToMD.getMarkdown(),
        saveTo: swaggerToMD.saveTo
      })
      await mdFile.save()
    }
  }
}

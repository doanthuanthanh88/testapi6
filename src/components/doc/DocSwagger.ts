import { OutputFile } from '@/components/output/OutputFile';
import { dump } from 'js-yaml';
import { isGotData, toJsonSchema } from '@/components/doc/DocUtils';
import { difference, merge } from 'lodash';
import { Testcase } from '@/components/Testcase';
import { Api } from '@/components/api/Api';
import { OpenAPI } from '@/components/doc/OpenAPI3';

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
  headers: string[]
  /** Only doc these response headers */
  responseHeaders: string[]
  /** Overide OpenAPI properties which system generated */
  raw: OpenAPI

  constructor(attrs: DocSwagger) {
    super(attrs)
  }

  async exec() {
    const self = this
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
      paths: {},
      components: {
        schemas: {}
      }
    }, this.raw)
    const apis = Testcase.APIs.filter(api => api.docs)
    let tags = this.raw.tags || []
    apis.forEach((api: Api) => {
      if (api.docs.swagger?.tags) {
        const newTags = difference(tags, api.docs.swagger?.tags as any)
        tags = tags.concat(newTags)
      }
      const pathName = api.url //(api.docs.pathname || api._url)
      if (!cnt.paths[pathName]) cnt.paths[pathName] = {}
      const method = api.method.toString().toLowerCase()
      const rs = {
        summary: api.docs?.swagger?.summary || api.title || '',
        description: api.docs?.swagger?.description || api.description || '',
        parameters: [],
        ...api.docs?.swagger,
        // externalDocs: {
        //   description: 'Try now',
        //   url: tag.toTestLink()
        // }
      } as any
      cnt.paths[pathName][method] = rs
      if (Object.keys(api.params || {}).length) {
        Object.keys(api.$url.params).forEach(k => {
          const p = api.$url.params[k]
          rs.parameters.push({
            in: 'path',
            name: p.name,
            required: p.required,
            // style: 'form',
            // explode: true,
            example: p.value,
            schema: toJsonSchema(p.value, jsonSchemaOptions)
          })
        })
      }
      if (api.query) {
        Object.keys(api.$url.query).forEach(k => {
          const p = api.$url.query[k]
          rs.parameters.push({
            in: 'query',
            name: p.name,
            required: p.required,
            // style: 'form',
            // explode: true,
            example: p.value,
            schema: toJsonSchema(p.value, jsonSchemaOptions)
          })
        })
      }
      // Request headers
      if (isGotData(this.headers)) {
        let arrs = Object.keys(api.headers)
        if (isGotData(this.headers)) {
          arrs = arrs.filter(e => this.headers.includes(e))
        }
        arrs.forEach(q => {
          rs.parameters.push({
            in: 'header',
            name: q,
            example: api.headers[q],
            schema: toJsonSchema(api.headers[q], jsonSchemaOptions)
          })
        })
      }
      // Request body
      if (isGotData(api.body)) {
        rs.requestBody = merge({}, rs.requestBody || {}, {
          content: {
            'application/json': {
              example: api.body,
              schema: toJsonSchema(api.body, jsonSchemaOptions)
            }
          }
        })
      }
      // Response
      if (isGotData(api.response)) {
        rs.responses = merge({}, rs.responses || {}, {
          [api.response.status]: {
            description: 'Success'
          }
        })

        if (isGotData(api.response.data, false)) {
          const [contentType] = api.response.headers['content-type']?.split(';')
          rs.responses[api.response.status].content = {
            [contentType]: {
              example: api.response.data,
              schema: toJsonSchema(api.response.data, jsonSchemaOptions)
            }
          }
        }

        let arrs = Object.keys(api.response.headers)
        if (isGotData(this.responseHeaders)) {
          arrs = arrs.filter(e => this.responseHeaders.includes(e))
        }
        rs.responses[api.response.status].headers = arrs.reduce((sum, e) => {
          sum[e] = {
            // example: tag.response.headers[e],
            description: api.response.headers[e],
            schema: toJsonSchema(api.response.headers[e], jsonSchemaOptions)
          }
          return sum
        }, {})
      }
    })
    this.content = dump(cnt)
    cnt.tags = tags
    if (!this.title) this.title = 'Swagger document'
    await this.save()
  }
}

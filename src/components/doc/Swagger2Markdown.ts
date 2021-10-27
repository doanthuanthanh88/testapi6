import { OpenAPI, Operation, Response } from '@/components/doc/OpenAPI3';
import { dump } from 'js-yaml';
import { isNaN, merge } from 'lodash';
import { parse, stringify } from 'querystring';
import { schemaToTableMD } from './DocUtils';

export class Swagger2Markdown {
  constructor(private swagger: OpenAPI, public saveTo: string) { }

  private getCURLString(obj: { method: string, headers?: object, body?: any, url: string, query?: object }) {
    const { CurlGenerator } = require('curl-generator')
    const [_url, _query] = obj.url.split('?')
    let fullUrl = _url
    let q: any
    if (_query) { q = parse(_query) }
    if (obj.query) q = merge({}, q, obj.query)
    if (q) fullUrl += '?' + stringify(q, undefined, undefined, { encodeURIComponent: str => str })
    return CurlGenerator({
      method: obj.method,
      headers: Object.keys(obj.headers || {}).reduce((sum, e) => {
        sum[e] = `${e}`
        return sum
      }, {}),
      body: obj.body,
      url: fullUrl
    })
  }

  getValueFromSchema(schemaObject: any, schemas: any) {
    try {
      if (schemaObject.$ref) {
        const typeNames = schemaObject.$ref.split('/')
        const typeName = typeNames[typeNames.length - 1]
        if (schemas[typeName]) {
          merge(schemaObject, schemas[typeName])
        }
      }
      if (schemaObject.type === 'object') {
        const rs = {}
        for (const k in schemaObject.properties) {
          rs[k] = this.getValueFromSchema(schemaObject.properties[k], schemas)
        }
        return rs
      } else if (schemaObject.type === 'array') {
        if (schemaObject.items.type === 'object' || schemaObject.items.type === 'array') {
          const rs = []
          rs.push(this.getValueFromSchema(schemaObject.items, schemas))
          return rs
        }
        const rs = schemaObject.example
        return rs
      } else if (schemaObject.type === 'number' || schemaObject.type === 'integer') {
        return +schemaObject.example
      } else if (schemaObject.type === 'boolean') {
        return (schemaObject.example !== null && schemaObject.example !== undefined) ? Boolean(schemaObject.example).valueOf() : schemaObject.example
      } else {
        return schemaObject.example
      }
    } catch {
      return '[ERROR] COULD_NOT_GET_VALUE_FROM_SCHEMA_IN_SWAGGER2MARKDOWN'
    }
  }

  private getTestAPI6String(servers: any[], obj: { method: string, validates: any[], title?: string, baseURL?: string, url: string, params: object, headers?: object, query?: object, body?: any }) {
    const defaultBaseURL = (servers[0] || {}).description
    return dump(JSON.parse(JSON.stringify([
      {
        Vars: servers.reduce((sum, server) => {
          sum[server.description] = server.url
          return sum
        }, {})
      },
      {
        [`${obj.method[0]}${obj.method.substr(1).toLowerCase()}`]: {
          title: obj.title,
          debug: 'details',
          baseURL: defaultBaseURL ? `\$\{${defaultBaseURL}\}` : obj.baseURL,
          url: obj.url,
          params: obj.params && Object.keys(obj.params).length ? obj.params : undefined,
          headers: obj.headers && Object.keys(obj.headers).length ? obj.headers : undefined,
          query: obj.query && Object.keys(obj.query).length ? obj.query : undefined,
          body: obj.body,
          validate: obj.validates.length ? obj.validates : undefined
        }
      }
    ])))
  }

  private convertHalfSchema2Schema(obj: any) {
    const rs = {
      type: 'object',
      properties: Object.keys(obj).reduce((sum, header) => {
        const des = obj[header].description
        sum[header] = obj[header].schema
        if (des) sum[header].description = des
        return sum
      }, {})
    }
    return rs
  }

  getMarkdown() {
    let menu = []
    const { info, servers, tags, paths, components = {} } = this.swagger
    const { title, description, version = '', contact } = info
    const { schemas } = components

    menu.push(`# ${title}`)
    if (description) {
      menu.push('')
      menu.push(`*${description}*  `)
    }
    menu.push('')
    menu.push('<br/>')
    menu.push('')
    menu.push(`Version \`${version}\`  `)
    if (info?.contact?.name) {
      menu.push(`Contact [${contact?.name}](mailto:${contact?.email})  `)
    }
    menu.push(`Updated At: \`${new Date().toString()}\``)
    menu.push('')
    menu.push('<br/>')
    menu.push('')
    if (servers) {
      menu.push('')
      menu.push('## Servers')
      menu = menu.concat(servers.map(server => `- ${server.description}: ${server.url}`))
      menu.push('')
    }

    tags.sort((a, b) => +(a.name > b.name) > 0 ? 1 : -1)

    const details = ['', '<br/><br/>', '']
    const menus = []
    menus.push(`|---: | ---- | ---- |`)
    let apiIndex = {} as any

    const allOfAPIs = [] as { pathName: string, method: string, api: Operation }[]
    Object.entries(paths).forEach(([pathName, path]) => {
      Object.entries(path).forEach(([method, api]) => {
        allOfAPIs.push({ pathName, method: method.toUpperCase(), api: api as Operation })
      })
    })

    tags.forEach(tag => {
      const idx = menus.length
      let len = 0
      allOfAPIs.forEach(({ pathName, method, api }) => {
        const apiKey = `${method}-${pathName}-${api.summary}`
        if (!apiIndex[apiKey]) apiIndex[apiKey] = Object.keys(apiIndex).length + 1
        if (api.tags.includes(tag.name)) {
          len++
          const tagTitle = api.deprecated ? `~~${api.summary}~~` : `${api.summary}`
          const tagURL = api.deprecated ? `~~${method} ${pathName}~~` : `${method} ${pathName}`
          menus.push(`|${len}.| [${tagTitle}](#${apiIndex[apiKey]}) | ${tagURL} | `)
        }
      })
      if (len) {
        menus.splice(idx, 0, `| <a name='ANCHOR_-1'></a> | **${tag.name}** - *${len} items* | |`)
      }
    })
    menu.push('')
    menus.splice(0, 0, `|     |   Title | Total ${Object.keys(apiIndex).length} items |`)

    allOfAPIs.forEach(({ pathName, method, api }) => {
      const apiKey = `${method}-${pathName}-${api.summary}`
      const tagTitle = api.deprecated ? `~~${api.summary}~~` : `${api.summary}`
      let lockIcon = ''
      if (api.security?.length > 0) {
        lockIcon = '🔒 '
      }
      details.push(`## <a name='${apiIndex[apiKey]}'></a>${lockIcon}${tagTitle}`)

      let strTag = (api.tags || []).map(tag => `\`🏷 ${tag}\` `).join(' ')
      // if (strTag) strTag = '###### ' + strTag
      details.push(strTag)

      if (api.description) {
        details.push(`${api.description}`, '')
      }

      details.push('')
      details.push('<br/>')
      details.push('')
      details.push(`URL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; **\`${pathName}\`**  `)
      details.push(`Method &nbsp; **\`${method}\`**  `)

      const curlIndex = details.length
      const testapi6Meta = {
        title: api.summary,
        method: method,
        url: pathName,
        validates: []
      } as any
      const curlMeta = {
        method,
        url: api.example
      } as any

      details.push('<br/>', '', '### Request', '')

      // Request params
      const params = api.parameters?.filter(parameter => parameter.in?.toLowerCase() === 'path') || []
      if (params?.length) {
        const reqParams = params.reduce((sum, q: any) => {
          sum.schema[q.name] = q
          sum.data[q.name] = q.schema?.example || ''
          return sum
        }, { schema: {}, data: {} } as any)

        details.push(`<details><summary>Request Params (example)</summary>`, '')
        details.push('```json', JSON.stringify(reqParams.data, null, '  '), '```', '')
        details.push(`</details>`, '')

        // details.push('```yaml')
        details.push(schemaToTableMD(schemas, this.convertHalfSchema2Schema(reqParams.schema)), '')
        // details.push('```', '')

        if (reqParams.data && Object.keys(reqParams.data).length) {
          testapi6Meta.query = reqParams.data
        }
      }

      // Request query
      const queries = api.parameters?.filter(parameter => parameter.in?.toLowerCase() === 'query') || []
      if (queries?.length) {
        const reqQuery = queries.reduce((sum, q: any) => {
          sum.schema[q.name] = q
          sum.data[q.name] = q.schema?.example || ''
          return sum
        }, { schema: {}, data: {} } as any)

        details.push(`<details><summary>Request Query (example)</summary>`, '')
        details.push('```json', JSON.stringify(reqQuery.data, null, '  '), '```', '')
        details.push(`</details>`, '')

        // details.push('```yaml')
        details.push(schemaToTableMD(schemas, this.convertHalfSchema2Schema(reqQuery.schema)), '')
        // details.push('```', '')

        if (reqQuery.data && Object.keys(reqQuery.data).length) {
          testapi6Meta.query = reqQuery.data
        }
      }

      // Request headers
      const headers = api.parameters?.filter(parameter => parameter.in?.toLowerCase() === 'header') || []
      if (headers?.length) {
        const reqHeaders = headers.reduce((sum, q: any) => {
          sum.schema[q.name] = q
          sum.data[q.name] = q.schema?.example || ''
          return sum
        }, { schema: {}, data: {} } as any)

        details.push(`<details><summary>Request Headers (example)</summary>`, '')
        details.push('```json', JSON.stringify(reqHeaders.data, null, '  '), '```', '')
        details.push(`</details>`, '')

        // details.push('```yaml')
        details.push(schemaToTableMD(schemas, this.convertHalfSchema2Schema(reqHeaders.schema)), '')
        // details.push('```', '')

        if (reqHeaders.data && Object.keys(reqHeaders.data).length) {
          curlMeta.headers = reqHeaders.data
          testapi6Meta.headers = reqHeaders.data
        }
      }

      // // Request body
      if (api.requestBody) {
        if (api.requestBody.description) {
          details.push(`${api.requestBody.description}`, '')
        }

        const bodyType = Object.keys(api.requestBody.content)[0] || 'raw'
        details.push(`<details><summary>Request Body - ${bodyType} (example)</summary>`, '')
        let requestBodyContent: any
        if (bodyType) {
          requestBodyContent = api.requestBody.content[bodyType]?.example
          if (!requestBodyContent) {
            requestBodyContent = this.getValueFromSchema(api.requestBody.content[bodyType].schema, schemas || {})
          } else {
            requestBodyContent = api.requestBody.content[bodyType].example
          }
          if (!bodyType.includes('text')) {
            details.push('```json', JSON.stringify(requestBodyContent, null, '  '), '```', '')
          } else {
            details.push('```text', api.requestBody.content[bodyType], '```')
          }
          details.push(`</details>`, '')
        }
        if (bodyType) {
          // details.push('```yaml')
          details.push(schemaToTableMD(schemas, api.requestBody.content[bodyType].schema), '')
          // details.push('```', '')
        }
        if (requestBodyContent) {
          curlMeta.body = testapi6Meta.body = requestBodyContent
        }
      }

      if (api.responses) {
        details.push('', '### Response', '')

        // Response data
        for (const statusCode in api.responses) {
          const response = api.responses[statusCode] as Response
          if (!testapi6Meta.validates.length) {
            if (!isNaN(statusCode)) {
              testapi6Meta.validates.push({
                Status: +statusCode
              })
            }
          }

          details.push(`<details open><summary>Response Status: ${statusCode} - ${response.description}</summary>`, '')

          if (response.headers && Object.keys(response.headers).length > 0) {
            const resHeaderData = Object.keys(response.headers).reduce((sum, name) => {
              const header = response.headers[name] as any
              sum[name] = header.schema?.example
              return sum
            }, {})
            details.push(`<details><summary>↳ Response Headers (example)</summary>`, '')
            details.push('```json', JSON.stringify(resHeaderData, null, '  '), '```', '')
            details.push(`</details>`, '')

            const resHeaders = this.convertHalfSchema2Schema(response.headers)
            // details.push('```yaml')
            details.push(schemaToTableMD(schemas, resHeaders), '')
            // details.push('```', '')
          }

          if (response.content) {
            for (const contentType in response.content) {
              if (!response.content[contentType]) continue
              let responseBodyContent: any
              responseBodyContent = response.content[contentType].example
              if (!responseBodyContent) {
                responseBodyContent = this.getValueFromSchema(response.content[contentType].schema, schemas || {})
              } else {
                responseBodyContent = response.content[contentType].example
              }
              details.push(`<details><summary>↳ Response Data - ${contentType} (example)</summary>`, '')
              details.push('```json', JSON.stringify(responseBodyContent, null, '  '), '```', '')
              details.push(`</details>`, '')

              // details.push('```yaml')
              details.push(schemaToTableMD(schemas, response.content[contentType].schema), '')
              // details.push('```', '')
            }
          }

          details.push(`</details>`, '')
        }
      }

      const command = []
      command.push(`<details><summary>Try it - cURL</summary>`, '')
      command.push('```sh', `${this.getCURLString(curlMeta)}`, '```', '')
      command.push('</details>', '')

      command.push(`<details><summary>Try it - testapi6</summary>`, '')
      command.push('```yaml', `${this.getTestAPI6String(api.servers || servers, testapi6Meta)}`, '```', '')
      command.push('</details>', '')

      details.splice(curlIndex, 0, ...command)

      details.push('')
      details.push('<br/><br/>')
      details.push('')

      // menu.splice(importIndex, 0, `| No.<a name='ANCHOR_-1'></a> | List APIs | [Import](${Api.toImportLink(testItems)}) |`)
    })

    const schemasMsg = ['', '## Schemas', '']
    Object.entries(schemas || {}).forEach(([typeName, type]) => {
      schemasMsg.push(`<details><summary><a name="${typeName}"></a>${typeName}</summary>`, '')
      // schemasMsg.push('```yaml')
      schemasMsg.push(schemaToTableMD(schemas, {
        type: "object",
        properties: {
          [typeName]: type
        }
      }))
      // schemasMsg.push('```')
      schemasMsg.push('')
      schemasMsg.push(`</details>`, '')
    })

    return menu
      .concat(menus)
      .concat(details)
      .concat(schemasMsg)
      .join('\n')
  }
}
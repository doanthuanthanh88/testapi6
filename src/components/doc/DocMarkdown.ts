import { Api } from '@/components/api/Api';
import { OutputFile } from '@/components/output/OutputFile';
import { Testcase } from '@/components/Testcase';
import { writeFileSync } from 'fs';
import { dump } from 'js-yaml';
import { merge, pick, uniqBy } from 'lodash';
import mkdirp from 'mkdirp';
import { dirname, join, relative } from 'path';
import { isGotData, schemaToMD, toJsonSchema } from './DocUtils';

/**
 * Export markdown document
 * ```yaml
 * - DocMarkdown:
 *     saveTo: test.md                       # Markdown ouput file
 *     headers: []                           # Only expose these request headers
 *     responseHeaders: ["content-type"]     # Only expose these response headers
 * ```
 */
export class DocMarkdown extends OutputFile {
  /** Only doc these request headers */
  allowHeaders: string[]
  /** Only doc these response headers */
  allowResponseHeaders: string[]
  /** Overide swagger properties which system generated */
  raw?: {
    /** Document title */
    title: string
    /** Document description */
    description?: string
    /** Document version */
    version: string
    /** Developer */
    developer: string
    /** Endpoints in service (production, staging, development) */
    servers: { [env: string]: string }
  }

  async exec() {
    let menu = []
    const { title, description, version = '', developer = '', servers } = this.tc
    this.raw = merge({ title, description, version, developer, servers }, this.raw)
    menu.push(`# ${this.raw.title || this.tc.title || ''}`)
    const des = this.raw.description || this.tc.description
    if (des) {
      menu.push('')
      menu.push(`_${des}_  `)
    }
    menu.push('')
    menu.push('<br/>')
    menu.push('')
    menu.push(`Version: \`${this.raw.version || this.tc.version || ''}\`  `)
    if (developer) {
      menu.push(`Developer: [${developer.split('@')[0]}](mailto:${developer})  `)
    }
    menu.push(`Last updated: \`${new Date().toString()}\``)
    menu.push('')
    menu.push('<br/>')
    menu.push('')
    if (servers) {
      menu.push('')
      menu.push('## Servers')
      menu = menu.concat(Object.keys(servers).map(des => `- ${des}: ${servers[des]}`))
      menu.push('')
      menu.push('<br/>')
      menu.push('')
    }

    const details = ['', '<br/><br/>', '']
    const apis = uniqBy(Testcase.APIs.filter(api => api.docs && api.title), e => `${e.method.toLowerCase()} ${e.url}`)
    const tags = [] as { name: string, items: Api[] }[]
    apis.forEach(a => {
      a.docs = merge({ md: { tags: [] }, tags: [] }, a.docs)
      if (!a.docs.md?.tags?.length && !a.docs.tags?.length) {
        a.docs.md.tags.push('default')
      }
      [...(a.docs?.md?.tags || []), ...(a.docs?.tags || [])].forEach(t => {
        let tag = tags.find(tag => tag.name === t)
        if (!tag) {
          tag = { name: t, items: [] }
          tags.push(tag)
        }
        tag.items.push(a)
      })
    })
    tags.sort((a, b) => +(a.name > b.name) > 0 ? 1 : -1)
    for (let tag of tags) {
      tag.items.sort((a, b) => +(a.title > b.title) > 0 ? 1 : -1)
    }

    const menus = []
    menus.push(`|     |   Title  | |      |      |`)
    menus.push(`|---: | ---- | ---- | ---- | ---- |`)

    const saveFolder = dirname(this.saveTo)
    const yamlFolder = join(saveFolder, 'yaml')
    mkdirp.sync(yamlFolder)

    for (let tag of tags) {
      const testItems = [] as any
      const idx = menus.length
      let len = 0

      tag.items.forEach((tag, i) => {
        const yamlFile = join(yamlFolder, Testcase.toFileName(tag.title) + '.yaml')
        writeFileSync(yamlFile, dump([
          {
            Vars: Object.keys(tag.tc.servers || {}).reduce((sum, e) => {
              sum[e] = tag.tc.servers[e]
              return sum
            }, {})
          },
          {
            [Api.getMethodTag(tag.method)]: tag.toTestAPI6()
          }
        ]))

        const testObj = tag.toTestObject()
        testItems.push(testObj)
        len++
        const tagTitle = tag.docs.deprecated ? `~~${tag.title}~~` : `${tag.title}`
        menus.push(`|${i + 1}.| [${tagTitle}](#${tag.index}) | ${tag.method} ${tag.url} | ` + `[Try now](${tag.toTestLink()}) | [YAML](${relative(saveFolder, yamlFile)}) |`)
      })
      menus.splice(idx, 0, `| <a name='ANCHOR_-1'></a> | __${tag.name}__ - _${len} items_ | |` + `[Import](${Api.toImportLink(testItems)}) |`)
    }
    menu.push('')


    apis.forEach((tag) => {
      const tagTitle = tag.docs.deprecated ? `~~${tag.title}~~` : `${tag.title}`
      details.push(`## <a name='${tag.index}'></a>${tagTitle}`)
      if (tag.description) {
        details.push(`_${tag.description}_`, '')
      }

      details.push((tag.docs.tags || []).map(t => `\`(${t})\``).join(' '))

      details.push('')
      details.push('<br/>')
      details.push('')
      details.push(`URL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; __\`${tag.url}\`__  `)
      details.push(`Method &nbsp; __\`${tag.method}\`__  `)
      details.push(`Status &nbsp;&nbsp;&nbsp; __\`${tag.response.status}\`__ _- ${tag.response.statusText}_  `, '')

      details.push(`<details><summary>cURL</summary>`, '')
      details.push('```sh', tag.toCUrl(), '```', '')
      details.push('</details>', '')

      details.push(`<details><summary>testapi6.yaml</summary>`, '')
      details.push('```yaml', dump({ [Api.getMethodTag(tag.method)]: tag.toTestAPI6() }), '```', '')
      details.push('</details>', '')

      details.push('<br/>', '<br/>', '', '### Request', '')

      // Request query
      const reqQuery = tag.query || {}
      if (isGotData(reqQuery, true)) {
        details.push(`<details><summary>Query</summary>`, '')
        details.push('```text', `${tag._axiosData.fullPathQuery(false)}`, '```', '')
        details.push(`</details>`, '')

        details.push('```yaml')
        details.push(schemaToMD({}, merge({}, toJsonSchema(reqQuery), tag.docs.query)))
        details.push('```', '')
      }

      // Request headers
      const _reqHeaders = tag.headers || {}
      const reqHeaders = this.allowHeaders?.length ? pick(_reqHeaders, this.allowHeaders) : _reqHeaders
      if (isGotData(reqHeaders, true)) {
        details.push(`<details><summary>Headers</summary>`, '')
        details.push('```json', JSON.stringify(reqHeaders, null, '  '), '```', '')
        details.push(`</details>`, '')

        details.push('```yaml')
        details.push(schemaToMD({}, merge({}, toJsonSchema(reqHeaders), tag.docs.headers)))
        details.push('```', '')
      }

      // Request body
      if (tag.isSupportBody) {
        if (isGotData(tag.body, false)) {
          details.push(`<details><summary>Body</summary>`, '')
          if (typeof tag.body === 'object') {
            details.push('```json', JSON.stringify(tag.body, null, '  '), '```', '')
          } else {
            details.push('```text', tag.body, '```')
          }
          details.push(`</details>`, '')

          details.push('```yaml')
          details.push(schemaToMD({}, merge({}, toJsonSchema(tag.body), tag.docs.body)))
          details.push('```', '')
        }
      }

      if (tag.response) {
        details.push('', '<br/>', '', '### Response', '')
        // Response headers
        const _resHeaders = tag.response?.headers || {}
        const resHeaders = this.allowResponseHeaders?.length ? pick(_resHeaders, this.allowResponseHeaders) : _resHeaders
        if (isGotData(resHeaders, true)) {
          details.push(`<details><summary>Headers</summary>`, '')
          details.push('```json', JSON.stringify(resHeaders, null, '  '), '```', '')
          details.push(`</details>`, '')

          details.push('```yaml')
          details.push(schemaToMD({}, merge({}, toJsonSchema(resHeaders), tag.docs.responseHeaders)))
          details.push('```', '')
        }

        // Response data
        if (isGotData(tag.response?.data, false)) {
          details.push(`<details><summary>Data</summary>`, '')
          if (typeof tag.response.data === 'object') {
            details.push('```json', JSON.stringify(tag.response.data, null, '  '), '```', '')
          } else {
            details.push('```text', tag.response.data, '```', '')
          }
          details.push(`</details>  `, '')

          if (typeof tag.response.data === 'object') {
            details.push('```yaml')
            details.push(schemaToMD({}, merge({}, toJsonSchema(tag.response.data), tag.docs.data)))
            details.push('```', '')
          }
        }
      }
      // Note
      // if (tag.docs?.md?.note) {
      //   details.push(`> Note:`)
      //   details.push('')
      //   details.push(tag.docs.md.note)
      // }
      details.push('')
      details.push('<br/><br/>')
      details.push('')
    })
    // menu.splice(importIndex, 0, `| No.<a name='ANCHOR_-1'></a> | List APIs | [Import](${Api.toImportLink(testItems)}) |`)
    menu = menu.concat(menus)

    this.content = menu.concat(details).join('\n')

    // if (this.raw?.docs && this.raw?.docs.md) {
    //   if (this.raw?.docs.md.note) {
    //     menu.push('---------------------')
    //     menu.push('## Note')
    //     menu.push(this.raw?.docs.md.note)
    //   }
    // }
    if (!this.title) this.title = 'Markdown document'
    await this.save()
  }
}

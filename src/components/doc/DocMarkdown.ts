import { Api } from '@/components/api/Api';
import { OutputFile } from '@/components/output/OutputFile';
import { Testcase } from '@/components/Testcase';
import { merge, pick, uniqBy } from 'lodash';
import { stringify } from 'querystring';
import { isGotData } from './DocUtils';

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
  headers: string[]
  /** Only doc these response headers */
  responseHeaders: string[]
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
    this.raw = merge({}, this.tc, this.raw)
    menu.push(`# ${this.raw.title || this.tc.title || ''}`)
    menu.push(`_${this.raw.description || this.tc.description || ''}_`)
    menu.push('')
    menu.push('')
    menu.push(`> Version \`${this.raw.version || this.tc.version || ''}\``)
    const developer = this.raw?.developer || this.tc.developer || ''
    if (developer) {
      menu.push('')
      menu.push(`> [**Contact ${developer.split('@')[0]}**](mailto:${developer})`)
      menu.push('')
    }
    menu.push('')
    menu.push(`> Last updated: \`${new Date().toString()}\``)
    menu.push('')
    menu.push('## APIs')
    const details = ['## Details']
    const apis = uniqBy(Testcase.APIs.filter(api => api.docs && api.title), e => `${e.method.toLowerCase()} ${e.url}`)
    const tags = [] as { name: string, items: Api[] }[]
    apis.forEach(a => {
      a.docs = merge({ md: { tags: [] } }, a.docs)
      if (!a.docs.md.tags.length) {
        a.docs.md.tags.push('default')
      }
      a.docs?.md?.tags?.forEach(t => {
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
    menus.push(`|No.  | API Description | Actions |`)
    menus.push(`|---: | ---- | ---- |`)

    for (let tag of tags) {
      const testItems = [] as any
      const idx = menus.length
      let len = 0
      tag.items.forEach((tag, i) => {
        testItems.push(tag.toTestObject())
        len++
        menus.push(`|${i + 1}.| [**${tag.title}**](#${tag.index}) |` + `[Try now](${tag.toTestLink()}) |`)
      })
      menus.splice(idx, 0, `| <a name='ANCHOR_-1'></a> | __${tag.name}__ - _${len} items_ |` + `[Import](${Api.toImportLink(testItems)}) |`)
    }
    menu.push('')

    apis.forEach((tag) => {
      details.push(`### <a name='${tag.index}'></a>[**${tag.title}**](${tag.toTestLink()})`)
      if (tag.description) {
        details.push(`_${tag.description}_`)
      }
      details.push('')
      details.push(`#### ${tag.response?.status} \`${tag.method}\` ${tag.url.replace(/\$?{([^}]+)}/g, '*`{$1}`*')}${tag.hasQuery ? `\?*${stringify(tag.query)}*` : ''}`)
      details.push('')

      details.push('#### **Request**')
      // Request headers
      const _reqHeaders = tag.headers || {}
      const reqHeaders = this.headers?.length ? pick(_reqHeaders, this.headers) : _reqHeaders
      if (isGotData(reqHeaders, true)) {
        details.push(...Object.keys(reqHeaders).map(k => `- \`${k}\`: *${reqHeaders[k]}*`))
      }

      // Request body
      if (tag.isSupportBody) {
        if (isGotData(tag.body, false)) {
          if (typeof tag.body === 'object') {
            details.push(`\`\`\`json`)
            details.push(JSON.stringify(tag.body, null, '  '))
            details.push(`\`\`\``)
          } else {
            details.push(`\`\`\`text`)
            details.push(tag.body)
            details.push(`\`\`\``)
          }
        }
      }

      if (tag.response) {
        details.push('#### **Response**')
        // Response headers
        const _resHeaders = tag.response?.headers || {}
        const resHeaders = this.responseHeaders?.length ? pick(_resHeaders, this.responseHeaders) : _resHeaders
        if (isGotData(resHeaders, true)) {
          details.push(...Object.keys(resHeaders).map(k => `- \`${k}\`: *${resHeaders[k]}*`))
        }

        // Response data
        if (isGotData(tag.response?.data, false)) {
          if (typeof tag.response.data === 'object') {
            details.push(`\`\`\`json`)
            details.push(JSON.stringify(tag.response.data, null, '  '))
            details.push(`\`\`\``)
          } else {
            details.push(`\`\`\`text`)
            details.push(tag.response.data)
            details.push(`\`\`\``)
          }
        }
      }
      // Note
      // if (tag.docs?.md?.note) {
      //   details.push(`> Note:`)
      //   details.push('')
      //   details.push(tag.docs.md.note)
      // }
    })
    // menu.splice(importIndex, 0, `| No.<a name='ANCHOR_-1'></a> | List APIs | [Import](${Api.toImportLink(testItems)}) |`)
    menu = menu.concat(menus)

    const servers = this.raw?.servers || this.tc.servers
    if (servers) {
      menu.push('## Servers')
      menu = menu.concat(Object.keys(servers).map(des => `- **${servers[des]}** - _${des}_`))
    }

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

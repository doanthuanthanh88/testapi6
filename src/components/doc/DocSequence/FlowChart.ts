import { context } from "@/Context"
import chalk from "chalk"
import { createWriteStream } from "fs"
import { join, relative } from "path"
import { DocSequence } from "."
import { ArrayUnique } from "./ArrayUnique"

export class FlowChart {
  private actors: Map<string, { subject: string, target: string, action: string, des: string, subType: string, tarType: string }>
  private globalObjects: Map<string, Array<{ name, uname }>>
  readonly lineStyle = {
    pub: 'fill:none,stroke:#f48924,stroke-width:1px;',
    sub: 'fill:none,stroke:#f48924,stroke-width:1px;',
    pubsub: 'fill:none,stroke:#f48924,stroke-width:2px;',
    req: 'fill:none,stroke:#0cb9c1,stroke-width:1px;',
    req2: 'fill:none,stroke:#0cb9c1,stroke-width:2px;',
    call: 'fill:none,stroke:#9f9fa3,stroke-width:1px;',
  }
  readonly defRect = {
    clients: '',
    apps: 'fill:#0cb9c1,color:#fff',
    services: 'fill:#74d2e7,color:#fff',
    databases: 'fill:#004d73,color:#fff',
    others: 'fill:#ffc168,color:#fff',
  }
  readonly subGraph = {
    service: '☀ <br/>',
    client: '☺ ☺ ☺ <br/>',
  }

  constructor(private docSequence: DocSequence) {
    this.actors = new Map()
    this.globalObjects = new Map()
  }

  getUpperName(name: string) {
    return name.replace(/\W/g, '').toUpperCase()
  }

  addActor(subject: string, target: string, action: string, des: string) {
    const sub = this.parseName(subject, action)
    const tar = this.parseName(target, action)
    for (let subname of sub.name.split('/')) {
      subname = subname.trim()
      for (let tarname of tar.name.split('/')) {
        tarname = tarname.trim()
        des = des.replace(/"/g, "'")
        this.actors.set(`${subname}:${tarname}:${action}:${des}`, { subject: this.getUpperName(subname), target: this.getUpperName(tarname), action, des, subType: sub.type, tarType: tar.type })
        this.addGlobalObject(subname, sub.type)
        this.addGlobalObject(tarname, tar.type)
      }
    }
  }

  private parseName(name: string, _action: string) {
    const m = name.match(/\s*([\(\[<\{})]{1,5})?([^\(\[<\)\]\{\}>)]+)([\)\]\}>)]{1,5})?/)
    let sign = ''
    let type = ''
    if (m) {
      name = m[2]
      const m1 = m[2].match(/^([\+\-])?(.+)/)
      name = m1[2].trim()
      sign = (m1[1] || '')
      if (m[1] && m[3]) {
        if (m[1] === '{{' && m[3] === '}}') {
          // Context {}
          type = 'App'
        } else if (m[1] === '{{{' && m[3] === '}}}') {
          // Client Context {Client}
          type = 'Client'
        } else if (m[1] === '{' && m[3] === '}') {
          // Service {ServiceName}
          if (name[0] === '.') {
            name = name.substr(1)
            type = 'App'
          } else {
            type = 'Services'
          }
        } else if (m[1] === '[' && m[3] === ']') {
          // Database [MySQL]
          type = 'Databases'
        } else if (m[1] === '(' && m[3] === ')') {
          type = 'Others'
        }
      }
    }
    return { name, sign, type, groupName: ['App', 'Client'].includes(type) ? type : name }
  }

  private addGlobalObject(name: string, type: string) {
    if (!this.globalObjects.get(type)) this.globalObjects.set(type, new Array())
    if (!this.globalObjects.get(type).find(e => e.name === name)) {
      this.globalObjects.get(type).push({ name, uname: this.getUpperName(name) })
    }
  }

  async printOverviewDetails(_mdFolder: string, mmdFolder: string, svgFolder: string) {
    const fileSave = join(this.docSequence.saveTo, 'overview.details.md')
    const fileMMDSave = join(mmdFolder, 'overview.details.mmd')
    const fileImageSave = join(svgFolder, 'overview.details.svg')
    context.group(`${chalk.green('%s %s')}`, 'Overview Details:', fileSave)
    await Promise.all([
      // Write mmd
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileMMDSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(this.getOverviewDetailsContent())
        writer.close()
      }),
      // Write md
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(`### Details\r\n`)
        writer.write(`![Service overview](${relative(this.docSequence.saveTo, fileImageSave)})\r\n`)
        writer.close()
        context.groupEnd()
      })
    ])
    // Generate image
    this.docSequence.addImage(fileMMDSave, fileImageSave)
    return fileSave
  }

  private getOverviewDetailsContent() {
    let msg = new ArrayUnique()
    msg.push('flowchart LR')
    msg.push(`%% ${this.docSequence.appName}`)
    this.globalObjects.forEach((names, key) => {
      switch (key) {
        case 'Client':
          if (this.defRect.clients) msg.add(`classDef ${key} ${this.defRect.clients}`)
          if (names.length > 1) {
            msg.push(`subgraph Client`)
            names.forEach(({ name, uname }) => {
              msg.add(`  ${uname}{{"${this.subGraph.client} ${name}"}}:::${key}`)
            })
            msg.push('end')
          } else {
            names.forEach(({ name, uname }) => {
              msg.add(`${uname}{{"${this.subGraph.client} ${name}"}}:::${key}`)
            })
          }
          break
        case 'App':
          if (this.defRect.apps) msg.add(`classDef ${key} ${this.defRect.apps}`)
          if (names.length > 1) {
            msg.push(`subgraph Components in app`)
            names.forEach(({ name, uname }) => {
              msg.add(`  ${uname}("${this.subGraph.service} ${name}"):::${key}`)
            })
            msg.push('end')
          } else {
            names.forEach(({ name, uname }) => {
              msg.add(`  ${uname}("${this.subGraph.service} ${name}"):::${key}`)
            })
          }
          break
        case 'Services':
          if (this.defRect.services) msg.add(`classDef ${key} ${this.defRect.services}`)
          msg.push(`subgraph Services`)
          names.forEach(({ name, uname }) => {
            msg.add(`    ${uname}("${this.subGraph.service} ${name}"):::${key}`)
          })
          msg.push('end')
          break
        case 'Databases':
          if (this.defRect.databases) msg.add(`classDef ${key} ${this.defRect.databases}`)
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}[("${name}")]:::${key}`)
          })
          break
        case 'Others':
          if (this.defRect.others) msg.add(`classDef ${key} ${this.defRect.others}`)
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}(("${name}")):::${key}`)
          })
          break
      }
    })
    const lineStyles = new ArrayUnique()
    const subMsg = new ArrayUnique()
    this.actors.forEach(({ subject, target, action, des }) => {
      switch (action) {
        case '=>':
        case 'x>':
          if (subMsg.add(`${subject} ---->|${des}| ${target}`)) {
            lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.req}`)
          }
          break
        case '->':
          if (subMsg.add(`${subject} -...->|${des}| ${target}`)) {
            lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.pub}`)
          }
          break
        case '<-':
          if (subMsg.add(`${subject} -...->|${des}| ${target}`)) {
            lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.sub}`)
          }
          break
        case '>':
        case '<':
          if (subMsg.add(`${subject} -...- ${target}`)) {
            lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.call}`)
          }
          break
      }
    })
    return msg.concat(subMsg).concat(lineStyles).join('\r\n')
  }

  async printOverview(_mdFolder: string, mmdFolder: string, svgFolder: string) {
    const fileSave = join(this.docSequence.saveTo, 'overview.md')
    const fileMMDSave = join(mmdFolder, 'overview.mmd')
    const fileImageSave = join(svgFolder, 'overview.svg')
    context.group(`${chalk.green('%s %s')}`, 'Overviews:', fileSave)
    await Promise.all([
      // Write mmd
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileMMDSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(this.getOverviewContent())
        writer.close()
      }),
      // Write md
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(`## Service overview\r\n`)
        writer.write(`_Show all of components in the service and describe the ways they connect to each others_\r\n`)
        writer.write(`![Service teleview](${relative(this.docSequence.saveTo, fileImageSave)})\r\n`)
        writer.close()
        context.groupEnd()
      })
    ])
    // Generate image
    this.docSequence.addImage(fileMMDSave, fileImageSave)
    return fileSave
  }

  private getOverviewContent() {
    let msg = new ArrayUnique()
    msg.push('flowchart LR')
    msg.push(`%% ${this.docSequence.appName}`)
    this.globalObjects.forEach((names, key) => {
      switch (key) {
        case 'Client':
          if (this.defRect.clients) msg.add(`classDef ${key} ${this.defRect.clients}`)
          msg.add(`CLIENT{{"${this.subGraph.client} ${key}"}}:::${key}`)
          break
        case 'App':
          key = 'Services'
          if (this.defRect.services) msg.add(`classDef ${key} ${this.defRect.services}`)
          msg.push(`subgraph Services`)
          msg.add(`  ${this.getUpperName(this.docSequence.appName)}("${this.subGraph.service} ${this.docSequence.appName}"):::${key}`)
          msg.push('end')
          break
        case 'Services':
          if (this.defRect.services) msg.add(`classDef ${key} ${this.defRect.services}`)
          msg.push(`subgraph Services`)
          names.forEach(({ name, uname }) => {
            msg.add(`    ${uname}("${this.subGraph.service} ${name}"):::${key}`)
          })
          msg.push('end')
          break
        case 'Databases':
          if (this.defRect.databases) msg.add(`classDef ${key} ${this.defRect.databases}`)
          msg.push(`subgraph Databases`)
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}[("${name}")]:::${key}`)
          })
          msg.push('end')
          break
        case 'Others':
          if (this.defRect.others) msg.add(`classDef ${key} ${this.defRect.others}`)
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}(("${name}")):::${key}`)
          })
          break
      }
    })
    const lineStyles = new ArrayUnique()
    const subMsg = new ArrayUnique()
    const hasCall = (msg: ArrayUnique, subject: string, target: string, ...actions: string[]) => {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]
        let idx = msg.findIndex(m => m.includes(`${subject} ${action} ${target}`))
        if (idx !== -1) return { idx, i }
        if (i === 1) {
          idx = msg.findIndex(m => m.includes(`${target} ${action} ${subject}`))
          if (idx !== -1) return { idx, i }
        }
      }
      return undefined
    }
    this.actors.forEach(({ subject, target, action, subType, tarType }) => {
      if (subType === 'App') subject = this.getUpperName(this.docSequence.appName)
      if (tarType === 'App') target = this.getUpperName(this.docSequence.appName)
      let idx: { idx: number, i: number } | undefined
      switch (action) {
        case '=>':
        case 'x>':
          idx = hasCall(subMsg, target, subject, '-->', '<-->')
          if (!idx) {
            if (subMsg.add(`${subject} --> ${target}`)) {
              lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.req}`)
            }
          } else if (idx.i === 0) {
            subMsg[idx.idx] = `${subject} <--> ${target}`
            lineStyles[idx.idx] = `linkStyle ${idx.idx} ${this.lineStyle.req2}`
          }
          break
        case '->':
          idx = hasCall(subMsg, target, subject, '-.->', '<-.->')
          if (!idx) {
            if (subMsg.add(`${subject} -.-> ${target}`)) {
              lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.pub}`)
            }
          } else if (idx.i === 0) {
            subMsg[idx.idx] = `${subject} <-.-> ${target}`
            lineStyles[idx.idx] = `linkStyle ${idx.idx} ${this.lineStyle.pubsub}`
          }
          break
        case '<-':
          idx = hasCall(subMsg, target, subject, '-.->', '<-.->')
          if (!idx) {
            if (subMsg.add(`${subject} -.-> ${target}`)) {
              lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.sub}`)
            }
          } else if (idx.i === 0) {
            subMsg[idx.idx] = `${subject} <-.-> ${target}`
            lineStyles[idx.idx] = `linkStyle ${idx.idx} ${this.lineStyle.pubsub}`
          }
          break
        case '>':
        case '<':
          if (subMsg.add(`${subject} -.- ${target}`)) {
            lineStyles.push(`linkStyle ${subMsg.length - 1} ${this.lineStyle.call}`)
          }
          break
      }
    })
    return msg.concat(subMsg).concat(lineStyles).join('\r\n')
  }
}
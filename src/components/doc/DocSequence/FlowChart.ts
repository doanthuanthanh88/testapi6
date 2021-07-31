import { context } from "@/Context"
import chalk from "chalk"
import { createWriteStream, readFileSync } from "fs"
import { join, relative } from "path"
import { DocSequence } from "."
import { ArrayUnique } from "./ArrayUnique"

export class FlowChart {
  private actors: Map<string, { subject: string, target: string, action: string, des: string, subType: string, tarType: string }>
  globalObjects: Map<string, Array<{ name, uname }>>
  globalObjectsKeys: string[]
  readonly lineStyle = {
    pub: 'fill:none,stroke:#f48924,stroke-width:1px;',
    sub: 'fill:none,stroke:#f48924,stroke-width:1px;',
    pubsub: 'fill:none,stroke:#f48924,stroke-width:2px;',
    req: 'fill:none,stroke:#0cb9c1,stroke-width:1px;',
    req2: 'fill:none,stroke:#0cb9c1,stroke-width:2px;',
    call: 'fill:none,stroke:#9f9fa3,stroke-width:1px;',
  }
  readonly color = [
    '#c04df9',
    '#ff4e50',
    '#f37736',
    '#0086ad',
    '#ff6289',
    '#1ebbd7',
    '#234d20',
    '#007777',
    '#2a4d69',
    '#8f9779',
    '#7289da',
    '#36802d',
    '#006666',
    '#97ebdb',
    '#4b86b4',
    '#ee4035',
    '#78866b',
    '#107dac',
    '#424549',
    '#fc913a',
    '#ff93ac',
    '#77ab59',
    '#005555',
    '#00c2c7',
    '#adcbe3',
    '#738276',
    '#189ad3',
    '#36393e',
    '#f9d62e',
    '#004444',
    '#738678',
    '#282b30',
    '#eae374',
    '#005073',
    '#7bc043',
    '#fc3468',
    '#f0f7da',
    '#003333',
    '#005582',
    '#63ace5',
    '#4d5d53',
    '#71c7ec',
    '#1e2124',
    '#e2f4c7',
    '#0392cf',
    '#ff084a',
  ]
  lineColors = new ArrayUnique()
  readonly defRect = {
    clients: '',
    apps: 'fill:#0cb9c1,color:#fff;',
    services: 'fill:#74d2e7,color:#fff;',
    databases: '', // 'fill:#d9534f,color:#fff;',
    others: '', // 'fill:#428bca,color:#fff;',
  }
  readonly subGraph = {
    service: '⌬ <br/>',
    client: '☺ ☺ ☺ <br/>',
  }

  constructor(private docSequence: DocSequence) {
    this.actors = new Map()
    this.globalObjects = new Map()
    this.globalObjectsKeys = new ArrayUnique()
  }

  getLineColor(uname: string) {
    let idx = this.lineColors.findIndex(n => n === uname)
    if (idx === -1) {
      idx = this.lineColors.push(uname) - 1
    }
    const color = this.color[idx % this.color.length]
    return `fill:none,stroke:${color},stroke-width:1px;`
  }

  getRectColor(name: string) {
    let idx = this.lineColors.findIndex(n => n === name)
    if (idx === -1) {
      idx = this.lineColors.push(name) - 1
    }
    const color = this.color[idx % this.color.length]
    return `fill:${color},color:#fff;`
  }

  getUpperName(name: string) {
    return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
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
    if (sub.name.includes('/')) this.addGlobalObject(sub.name, 'Apps')
    if (tar.name.includes('/')) this.addGlobalObject(tar.name, 'Apps')
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
    if (!this.globalObjects.get(type)) {
      this.globalObjects.set(type, new Array())
      this.globalObjectsKeys.push(type)
    }
    if (!this.globalObjects.get(type).find(e => e.name === name)) {
      this.globalObjects.get(type).push({ name, uname: this.getUpperName(name) })
    }
  }

  async printOverviewDetails(mdTasks: Promise<any>[], _mdFolder: string, mmdFolder: string, svgFolder: string) {
    const fileSave = join(this.docSequence.saveTo, 'overview.details.md')
    const fileMMDSave = join(mmdFolder, 'overview.details.mmd')
    const fileImageSave = join(svgFolder, 'overview.details.svg')
    context.group(`${chalk.green('%s %s')}`, 'Overview Details:', fileSave)
    // Write mmd
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileMMDSave)
      writer.once('finish', resolve)
      writer.once('error', reject)
      writer.write(this.getOverviewDetailsContent())
      writer.end()
    })
    // Write md to show details later
    mdTasks.push(
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileSave)
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write(`## Components & Actions\r\n`)
        writer.write(`_Flows & Actions details between the application and others components_\r\n\r\n`)
        if (this.docSequence.outputType === 'svg') {
          // svg
          writer.write(`![ComponentsActions](${relative(this.docSequence.saveTo, fileImageSave)})\r\n`)
        } else {
          // mmd
          writer.write('```mermaid\r\n')
          writer.write(readFileSync(fileMMDSave))
          writer.write('\r\n')
          writer.write('```')
        }
        writer.end()
        context.groupEnd()
      })
    )
    // Generate image
    this.docSequence.addImage(fileMMDSave, fileImageSave)
    return fileSave
  }

  private getOverviewDetailsContent() {
    let msg = new ArrayUnique()
    msg.push('flowchart LR')
    msg.push(`%% ${this.docSequence.appName}`)
    if (this.defRect.services) msg.add(`classDef Services ${this.defRect.services}`)
    if (this.defRect.databases) msg.add(`classDef Databases ${this.defRect.databases}`)
    if (this.defRect.others) msg.add(`classDef Others ${this.defRect.others}`)
    if (this.defRect.apps) msg.add(`classDef App ${this.defRect.apps}`)
    if (this.defRect.clients) msg.add(`classDef Client ${this.defRect.clients}`)
    for (const key of this.globalObjectsKeys) {
      const names = this.globalObjects.get(key)
      switch (key) {
        case 'Client':
          if (names.length > 1) {
            msg.push(`subgraph Client`)
            names.forEach(({ name, uname }) => {
              if (!this.globalObjects.get('App').find(names => names.uname === uname)) {
                msg.add(`  ${uname}{{"${this.subGraph.client} ${name}"}}:::${key}`)
              }
            })
            msg.push('end')
          } else {
            names.forEach(({ name, uname }) => {
              msg.add(`${uname}{{"${this.subGraph.client} ${name}"}}:::${key}`)
            })
          }
          break
        case 'App':
          if (names.length > 1) {
            msg.push(`subgraph Main`)
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
          msg.push(`subgraph Other-Services`)
          names.forEach(({ name, uname }) => {
            msg.add(`    ${uname}("${this.subGraph.service} ${name}"):::${key}`)
          })
          msg.push('end')
          break
        case 'Databases':
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}[("${name}")]:::${key}`)
          })
          break
        case 'Others':
          names.forEach(({ name, uname }) => {
            msg.add(`${uname}(("${name}")):::${key}`)
          })
          break
      }
    }
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

  async printOverview(mdTasks: Promise<any>[], _mdFolder: string, mmdFolder: string, svgFolder: string) {
    const fileSave = join(this.docSequence.saveTo, 'overview.md')
    const fileMMDSave = join(mmdFolder, 'overview.mmd')
    const fileImageSave = join(svgFolder, 'overview.svg')
    context.group(`${chalk.green('%s %s')}`, 'Overviews:', fileSave)
    // Write mmd
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileMMDSave)
      writer.once('finish', resolve)
      writer.once('error', reject)
      writer.write(this.getOverviewContent())
      writer.end()
    })
    // Write md to show details later
    mdTasks.push(
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileSave)
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write(`## Overview\r\n`)
        writer.write(`_List all of components in the application & describe the ways they comunicate to each others_\r\n\r\n`)
        if (this.docSequence.outputType === 'svg') {
          // svg
          writer.write(`![Overview](${relative(this.docSequence.saveTo, fileImageSave)})\r\n`)
        } else {
          // mmd
          writer.write('```mermaid\r\n')
          writer.write(readFileSync(fileMMDSave))
          writer.write('\r\n')
          writer.write('```')
        }
        writer.end()
        context.groupEnd()
      })
    )
    // Generate image
    this.docSequence.addImage(fileMMDSave, fileImageSave)
    return fileSave
  }

  private getOverviewContent() {
    let msg = new ArrayUnique()
    msg.push('flowchart LR')
    msg.push(`%% ${this.docSequence.title}`)
    const uname = this.getUpperName(this.docSequence.appName)
    for (let key of this.globalObjectsKeys) {
      const names = this.globalObjects.get(key)
      switch (key) {
        case 'Client':
          if (this.defRect.clients) msg.add(`classDef ${key} ${this.defRect.clients}`)
          msg.add(`CLIENT{{"${this.subGraph.client} ${key}"}}:::${key}`)
          break
        case 'App':
          if (this.defRect.apps) msg.add(`classDef ${uname} ${this.defRect.apps}`)
          msg.push(`subgraph Other-Services`)
          msg.add(`  ${uname}("${this.subGraph.service} ${this.docSequence.title}"):::${uname}`)
          msg.push('end')
          break
        case 'Services':
          msg.push(`subgraph Other-Services`)
          names.forEach(({ name, uname }) => {
            if (this.defRect.services) msg.add(`classDef ${uname} ${this.defRect.services}`)
            msg.add(`    ${uname}("${this.subGraph.service} ${name}"):::${uname}`)
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
    }
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
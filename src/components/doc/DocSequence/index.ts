import { Exec } from '@/components/external/Exec'
import { Require } from '@/components/Require'
import { Tag } from '@/components/Tag'
import { Testcase } from '@/components/Testcase'
import { context } from "@/Context"
import chalk from 'chalk'
import { createReadStream, createWriteStream, readdirSync, readFileSync, statSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import mkdirp from 'mkdirp'
import { dirname, extname, join, relative } from 'path'
import * as readline from 'readline'
import { ArrayUnique } from './ArrayUnique'
import { Comment } from './Comment'
import { FlowChart } from './FlowChart'
import { EMPTY } from './SeqTag'

export class DocSequence extends Tag {
  /** Document description */
  description?: string
  /** Not scan in these paths */
  excludes?: string[]
  /** Only scan file with the extensions */
  ext?: string[]
  /** Root path to scan */
  src: string[]
  /** Export sequence diagram to this path */
  saveTo: string
  /** Output type */
  outputType = 'mmd' as 'mmd' | 'svg'
  /** Auto generate number in sequence diagram */
  autoNumber?: boolean
  /** Activations can be stacked for same actor */
  stack: boolean
  /** Space code */
  space?: number
  /** Chart background color. (Not support .svg) */
  backgroundColor?: string
  /** Chart width */
  width: number
  /** Chart height */
  height: number
  /** Mermaid config for mermaid */
  config: any
  /** CSS file for the page */
  cssFile: string
  /** Show event details */
  showEventDetails: boolean
  /** Show request details */
  showRequestDetails: boolean
  /** Run by node command */
  runOnNodeJS: boolean
  /** Concat all of teleview diagrams to summary all of services */
  combineOverviews: string[]
  /** Puppeteer config */
  puppeteerConfig: any
  /** Path of puppeteer module to generate to .svg */
  puppeteerPath: any
  /** Output template */
  template: 'gitlab.wiki' | 'github'
  /** Theme */
  theme: 'default' | 'forest' | 'dark' | 'neutral'
  /** API documents in gitlab.wiki */
  externalLinks: { name: string, url: string }[]

  _stackFrom: string
  _stackTo: string
  _nodeModulePath: string
  _genImages: { input: string, output: string }[]

  get appName() {
    return this.title?.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_').replace(/_+/g, '_') || 'App'
  }

  private totalFiles = 0
  private roots = [] as Comment[]
  _flowChart = new FlowChart(this)
  private result = {
    clazz: '',
    overview: '',
    teleview: '',
    sequence: ''
  }
  fileTypes = {
    js: {
      excludes: ['node_modules', 'dist'],
      commentTag: '///'
    },
    ts: {
      excludes: ['node_modules', 'dist'],
      commentTag: '///'
    },
    go: {
      excludes: [],
      commentTag: '///'
    },
    java: {
      excludes: ['bin', 'build'],
      commentTag: '///'
    },
    py: {
      excludes: ['__pycache__'],
      commentTag: '#/'
    },
    yaml: {
      excludes: [],
      commentTag: '#/'
    }
  }

  init(attrs: any) {
    super.init(attrs)
    this._genImages = []
    if (!this.space) this.space = 0
    try {
      // this._nodeModulePath = require.resolve('@mermaid-js/mermaid-cli/index.bundle.js')
      this._nodeModulePath = __dirname + '/mmdc/mmdc.js'
    } catch {
      this._nodeModulePath = require.resolve('@mermaid-js/mermaid-cli/index.js')
    }
    if (!this.template) this.template = 'github'
    if (this.showEventDetails === undefined) this.showEventDetails = true
    if (this.showRequestDetails === undefined) this.showRequestDetails = true
    if (!this.ext) this.ext = Object.keys(this.fileTypes).map(e => `.${e}`)
    if (!this.excludes) this.excludes = ['node_modules']
    this._stackFrom = this.stack ? '+' : ''
    this._stackTo = this.stack ? '-' : ''
    if (attrs.src) {
      if (!Array.isArray(attrs.src)) this.src = [attrs.src]
      this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    }
    if (!this.title) this.title = 'My Service'
    if (this.saveTo) {
      this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    }
  }

  async exec() {
    this.roots = []
    context.group(chalk.green(this.title, this.src?.join(', ') || ''))
    context.group()
    const begin = Date.now()
    if (this.src) {
      await Promise.all(this.src.map(f => this.scan(f)))
      context.log()
      context.log(`- Scaned ${this.totalFiles} files in ${Date.now() - begin}ms`)
      context.log()
    }
    context.groupEnd()
    await this.print()
    context.groupEnd()
  }

  async scan(folder: string) {
    const f = statSync(folder)
    if (f.isFile()) {
      if (!this.ext?.length || this.ext.includes(extname(folder))) {
        this.totalFiles++
        const file = folder
        const roots = await this.readFileContent(file)
        this.roots.push(...roots.filter(e => e.outputName))
      }
    } else if (f.isDirectory()) {
      if (!this.excludes || !this.excludes.find(e => folder.includes(e))) {
        const folders = readdirSync(folder)
        this.totalFiles += folders.length
        for (const f of folders) {
          await this.scan(join(folder, f))
        }
        // await Promise.all(folders.map(f => join(folder, f)).map(f => this.scan(f)))
        // await Promise.all(folders.map(f => this.scan(join(folder, f))))
      }
    }
  }

  private async readFileContent(file: string) {
    const fileStream = createReadStream(file);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    const roots = []
    const fileType = this.fileTypes[extname(file).substr(1)]
    if (!fileType) {
      context.log(chalk.yellow(`- Not support file "${file}"`))
      return roots
    }
    let cur: Comment
    const pt = new RegExp(`^(\\s*)${fileType.commentTag}\\s?(\\s*)(.*)`, 'm')
    const ptSpace = new RegExp(`^(\\s*)`, 'm')
    let space = new Array(this.space).fill(' ').join('')
    let first: Comment
    for await (let line of rl) {
      let m = line.match(pt)
      if (m) {
        if (!space) space = m[1]
        m[1] += (m[2] || '')
        const startC = m[1].length
        const cnt = m[3].trim()
        const Clazz = Comment.getSeqType(cnt) as typeof Comment
        let newOne = new Clazz(cnt, startC, first?.umlType, cur)
        if (newOne.ignore) continue
        newOne.docSequence = this
        if (!first || first.startC === newOne.startC || first.umlType !== newOne.umlType) {
          if (!cnt) {
            cur = first = undefined
            this.space = 0
            space = ''
            continue
          }
          newOne.init(true)
          // newOne.root = first
          if (newOne.umlType === 'sequence') {
            if (newOne.key) {
              newOne = Comment.Comments.get(newOne.key)
            } else {
              roots.push(newOne)
            }
          }
          first = newOne
          cur = newOne
        } else {
          newOne.init(false)
          // newOne.root = cur.root
          const level = newOne.getLevel(cur)
          if (level === 'child') {
            try {
              let empty: EMPTY = cur
              const childLevel = (newOne.startC - cur.startC) / space.length
              new Array(childLevel - 1).fill(null).forEach((_, i) => {
                const newEmpty = new EMPTY('', cur.startC + (space.length * (i + 1)), empty.umlType, empty)
                newEmpty.parent = empty
                newEmpty.docSequence = empty.docSequence
                empty.childs.push(newEmpty)
                empty = newEmpty
                // empty.root = empty.parent.root
              })
              newOne.parent = empty
              // newOne.ctx = newOne.parent.ctx
              empty.childs.push(newOne)
            } catch (err) {
              context.error('Error tab in child', chalk.red(line))
              throw err
            }
          } else if (level === 'parent') {
            try {
              const parentLevel = (cur.startC - newOne.startC) / space.length
              let parent = cur.parent
              new Array(parentLevel).fill(null).forEach(() => {
                parent = parent.parent
              })
              newOne.parent = parent
              newOne.parent.childs.push(newOne)
            } catch (err) {
              context.error('Error tab in parent', chalk.red(line))
              throw err
            }
          } else {
            newOne.parent = cur.parent
            cur.parent.childs.push(newOne)
          }
          if (newOne.name && !newOne.childs.length) {
            const m = newOne.name.match(/^([^<]+)((<>)|(<=>))([^:]+)([^;]+)(;?(.*))?/)
            if (m) {
              const nextOne = newOne.clone()
              if (m[3]) {
                newOne.name = `${m[1]}>${m[5]}:${m[6]}`
                nextOne.name = `${m[1]}<${m[5]}:${m[8] || 'Return'}`
              } else if (m[4]) {
                newOne.name = `${m[1]}=>${m[5]}:${m[6]}`
                nextOne.name = `${m[1]}<=${m[5]}:${m[8] || 'Return'}`
              }
              newOne.parent.childs.push(nextOne)
              newOne = nextOne
            }
          }
          cur = newOne
          while (cur.constructor.name === 'Comment' && newOne.umlType === 'sequence' && cur.parent) {
            cur = cur.parent
          }
        }
      } else if (!space) {
        const m = line.match(ptSpace)
        if (m) {
          space = m[1]
        }
      }
    }
    return roots
  }

  addImage(mmdFile: string, svgFile: string) {
    this._genImages.push({ input: mmdFile, output: svgFile })
  }

  async genImage() {
    if (this.outputType === 'svg') {
      try {
        try {
          this.puppeteerPath = await Require.getPathGlobalModule('puppeteer', this.puppeteerPath ? dirname(this.puppeteerPath) : undefined)
          await this.genImagePuperteer()
        } catch (err) {
          context.log('')
          throw new Error('Could not generate ".svg" from ".mmd" in DocSequence')
        }
        return true
      } catch {
        context.log('')
        context.log(chalk.yellow('Warning:', 'To generate to .svg must run `npm install -g puppeteer` OR `yarn global add puppeteer`'))
        this.outputType = 'mmd'
      }
    }
    return false
  }

  async genImagePuperteer() {
    if (!this._genImages.length) return
    const genImage = new Exec()
    const inputs = this._genImages.map(e => e.input).join(',')
    const outputs = this._genImages.map(e => e.output).join(',')
    const args = []
    if (this.runOnNodeJS) args.push('node')
    args.push(this._nodeModulePath, '--input', inputs, '--output', outputs)
    args.push('--puppeteerPath', this.puppeteerPath)
    if (this.puppeteerConfig) args.push('--puppeteerConfig', JSON.stringify(this.puppeteerConfig))
    if (this.theme) args.push('--theme', this.theme)
    if (this.backgroundColor) args.push('--backgroundColor', this.backgroundColor)
    if (this.width) args.push('--width', this.width.toString())
    if (this.height) args.push('--height', this.height.toString())
    if (this.config) args.push('--config', JSON.stringify(this.config))
    if (this.cssFile) args.push('--cssFile', Testcase.getPathFromRoot(this.cssFile))
    genImage.init({
      // shell: true,
      // detached: true,
      slient: this.slient,
      args
    })
    await genImage.exec()
  }

  // @deprecate
  async _genImageJSDom() {
    if (!this._genImages.length) return
    const { JSDOM, ResourceLoader } = require('jsdom')
    let mermaidConfig = {
      logLevel: 1,
      theme: this.theme,
      startOnLoad: true,
      class: {
        // htmlLabels: false,
        useMaxWidth: false,
        diagramPadding: 8
      },
      flowchart: {
        // htmlLabels: false,
        useMaxWidth: false,
        diagramPadding: 8,
        // curve: 'basis',
        // curve: 'linear',
        curve: 'cardinal',
      },
      sequence: {
        // htmlLabels: false,
        diagramMarginX: 8,
        diagramMarginY: 8,
        actorMargin: 24,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        messageAlign: 'center',
        mirrorActors: false,
        bottomMarginAdj: 1,
        useMaxWidth: false,
        rightAngles: true
      }
    }
    if (this.config) mermaidConfig = Object.assign(mermaidConfig, this.config)

    class CustomResourceLoader extends ResourceLoader {
      constructor(...args) {
        super(...args)
      }
      fetch(url, options) {
        if (url === 'http://doanthuanthanh88.com/mermaid.min.js') {
          return readFile(join(__dirname, 'mmdc/mermaid.min.js')) as any
        }
        return super.fetch(url, options);
      }
    }
    const dom = new JSDOM(`<!doctype html>
    <html>
    <body>
      ${this._genImages.map((e, i) => `<div id="container${i}" output="${e.output}" class="mermaid">${readFileSync(e.input).toString()}</div>`).join('\n')}
      <script src="http://doanthuanthanh88.com/mermaid.min.js"></script>
      <script>
        const totalItem = ${this._genImages.length}
        const mermaidConfig = ${JSON.stringify(mermaidConfig)}
        window.mermaid.initialize(mermaidConfig)
        let tm = setInterval(() => {
          if(!tm) return
          const list = window.document.querySelectorAll('.mermaid[data-processed="true"]')
          if (totalItem === list.length) {
            clearInterval(tm)
            tm = undefined
            const svgs = []
            list.forEach(e => {
              svgs.push({
                output: e.getAttribute('output'),
                svg: e.innerHTML.replace(/<br>/gi, '<br/>')
              })
            })
            window.dispatchEvent(new CustomEvent('mmdc.done', { detail: svgs }))
          }
        }, 300)
      </script>
    </body>
    </html>`, {
      beforeParse(window) {
        window.Element.prototype.getBBox = function () {
          try {
            if (this.tagName === 'svg') {
              return {
                width: 1024,
                height: 1024
              }
            } else if (this.textContent) {
              return {
                width: this.textContent.length * 10,
                height: this.textContent.length * 10,
              }
            }
            console.log('TAGNAME==============', this.tagName, this.textContent)
            return { width: 0, height: 0 }
          } catch (err) {
            debugger
          }
        }
      },
      resources: new CustomResourceLoader({
        strictSSL: false,
      }),
      runScripts: "dangerously",
    })
    const svgs = await new Promise((resolve) => {
      dom.window.addEventListener('mmdc.done', ({ detail }) => {
        resolve(detail)
      });
    }) as any[]
    await Promise.all(svgs.map(({ svg, output }) => writeFile(output, svg)))
  }

  private async printSequence(mdTasks: Promise<any>[], mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!this.roots.length) return
    this.roots.sort((a, b) => {
      if (a.title < b.title) { return -1 }
      if (a.title > b.title) { return 1 }
      return 0
    })
    for (const root of this.roots) {
      const fileSave = join(mdFolder, root.outputName + '.md')
      const fileMMDSave = join(mmdFolder, root.outputName + '.mmd')
      const fileImageSave = join(svgFolder, root.outputName + '.svg')
      context.group(`${chalk.green('%s %s')}`, 'Diagram:', fileSave)
      // Write mmd
      await new Promise((resolve, reject) => {
        const writer = createWriteStream(fileMMDSave)
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write('sequenceDiagram\r\n')
        if (this.autoNumber) writer.write('autonumber\r\n')
        // Write participant
        const msg = new ArrayUnique()
        root.print(msg, 0, undefined)
        const participant = new ArrayUnique()
        for (const key of this._flowChart.globalObjectsKeys) {
          const names = this._flowChart.globalObjects.get(key)
          switch (key) {
            case 'Client':
              names.forEach(({ name, uname }) => {
                if (root.participants.includes(uname)) {
                  participant.add(`participant ${uname} as ${this._flowChart.subGraph.client}${name}`)
                }
              })
              break
            case 'Apps':
              names.forEach(({ name, uname }) => {
                if (root.participants.includes(uname)) {
                  participant.add(`participant ${uname} as ${this._flowChart.subGraph.service}${name}`)
                }
              })
              break
            case 'App':
              names
                .filter(({ name }) => !this._flowChart.globalObjects.get('Apps')?.find(c => new RegExp(`(/\\s?${name})|(${name}\\s?/)`, 'i').test(c.name)))
                .forEach(({ name, uname }) => {
                  if (root.participants.includes(uname)) {
                    participant.add(`participant ${uname} as ${this._flowChart.subGraph.service}${name}`)
                  }
                })
              break
            case 'Services':
              names.forEach(({ name, uname }) => {
                if (root.participants.includes(uname)) {
                  participant.add(`participant ${uname} as ${this._flowChart.subGraph.service}${name}`)
                }
              })
              break
            case 'Databases':
              names.forEach(({ name, uname }) => {
                if (root.participants.includes(uname)) {
                  participant.add(`participant ${uname} as ${name}`)
                }
              })
              break
            case 'Others':
              names.forEach(({ name, uname }) => {
                if (root.participants.includes(uname)) {
                  participant.add(`participant ${uname} as ${name}`)
                }
              })
              break
          }
        }
        writer.write(participant.concat(msg).join('\r\n'))
        writer.write('\r\n')
        writer.end()
      })
      // Write md to show details later
      mdTasks.push(
        new Promise(async (resolve, reject) => {
          const writer = createWriteStream(fileSave)
          writer.once('finish', resolve)
          writer.once('error', reject)
          writer.write(`## ${root.title}\r\n`)
          if (this.outputType === 'svg') {
            // svg
            writer.write(`![${root.title}](${relative(mdFolder, fileImageSave)})\r\n`)
          } else {
            // mmd
            writer.write('```mermaid\r\n')
            writer.write(readFileSync(fileMMDSave))
            writer.write('\r\n')
            writer.write('```')
          }
          // Ref document
          if (root.mdLinks?.length) {
            writer.write('## Reference sequence diagram\r\n')
            let cnt = ''
            Array.from(new Set(root.mdLinks)).forEach(link => {
              cnt += `- [${link}](${relative(dirname(mdFolder), join(mdFolder, Testcase.toFileName(link)))})\r\n`
            })
            if (this.template !== 'gitlab.wiki') {
              writer.write(cnt)
            } else {
              writer.write(this.removeMDInLink(cnt))
            }
            writer.write('\r\n')
          }
          // Print error code
          let msg = []
          let msgProps = {
            responses: {}
          }
          Object.keys(root.errors)
            .sort()
            .forEach(status => {
              let space = ''
              msg.push(`- \`${status}\`: ${root.errors[status]?.message || ''}`)
              space = '  '
              msgProps.responses[status] = {
                description: root.errors[status]?.message || '',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: []
                    }
                  }
                }
              }
              const schemas = msgProps.responses[status].content['application/json']
              Object.keys(root.errors[status].details).forEach(code => {
                root.errors[status].details[code].forEach(e => {
                  const _msg = `${space}- \`${e.code}\` ${e.message}`
                  if (!msg.includes(_msg)) {
                    msg.push(_msg)
                    const exsited = schemas.schema.oneOf.find(o => o.title === e.code)
                    if (!exsited) {
                      schemas.schema.oneOf.push({
                        type: 'object',
                        title: e.code,
                        properties: Object.keys(e).reduce((sum, key) => {
                          sum[key] = {
                            description: `- ${e[key]}  `
                          }
                          return sum
                        }, {})
                      })
                    } else {
                      Object.keys(e).forEach((key) => {
                        if (key !== 'code') {
                          exsited.properties[key].description += `\r\n- ${e[key]}  `
                        }
                      }, {})
                    }
                  }
                })
              })
              if (!schemas.schema.oneOf.length) {
                schemas.schema.oneOf.sort((a, b) => a.code - b.code)
                delete schemas.schema
              }
            })
          msg = msg.flat()
          if (msg.length) {
            writer.write('## Error code\r\n')
            writer.write(msg.join('\n'))
            writer.write('\r\n')

            writer.write(`\r\n<details><summary>Open API (example)</summary>\r\n`)
            writer.write('\r\n```yaml\r\n' + context.Utils.yaml(msgProps) + '\r\n```')
            writer.write(`\r\n</details>\r\n`)
          }
          writer.end()
          root.src = fileSave
          context.groupEnd()
        }))
      // Generate image
      this.addImage(fileMMDSave, fileImageSave)
    }
    const fileSave = join(this.saveTo, 'sequence.md')
    context.group(`${chalk.green('%s %s')}`, 'Sequence diagram:', fileSave)
    // Write md file to show list sequences
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileSave)
      writer.once('finish', resolve)
      writer.once('error', reject)
      writer.write(`## Sequence diagram\r\n`)
      writer.write(`_Describe business logic flows in each of APIs, workers... in the service_\r\n\r\n`)
      this.roots.forEach((root, i) => {
        writer.write(`${i + 1}.[${root.title}](${relative(this.saveTo, root.src)})  \r\n`)
      })
      writer.write('\r\n')
      this.result.sequence = fileSave
      writer.end()
      context.groupEnd()
    })
  }

  private async printClasses(mdTasks: Promise<any>[], _mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!Comment.Classes.length) return
    const fileSave = join(this.saveTo, 'data_model.md')
    const fileMMDSave = join(mmdFolder, 'data_model.mmd')
    const fileImageSave = join(svgFolder, 'data_model.svg')
    context.group(`${chalk.green('%s %s')}  `, 'Data model:', fileSave)
    // Write mmd
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileMMDSave)
      writer.once('finish', resolve)
      writer.once('error', reject)
      writer.write('classDiagram\r\n')
      Comment.Classes.forEach((root) => {
        root.printClass(writer, 0, undefined)
      })
      writer.end()
    })
    // Write md to show details later
    mdTasks.push(
      new Promise((resolve, reject) => {
        const writer = fileSave ? createWriteStream(fileSave) : null
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write(`## Data model\r\n`)
        writer.write(`_Data structure and relations between them in the service_\r\n`)
        if (this.outputType === 'svg') {
          // svg
          writer.write(`![Data model](${relative(this.saveTo, fileImageSave)})  \r\n`)
        } else {
          // mmd
          writer.write('```mermaid\r\n')
          writer.write(readFileSync(fileMMDSave))
          writer.write('\r\n')
          writer.write('```')
        }
        writer.end()
        this.result.clazz = fileSave
        context.groupEnd()
      })
    )
    // Generate image
    this.addImage(fileMMDSave, fileImageSave)
  }

  private async printDefaultMarkdown(_mdFolder: string, _mmdFolder: string, _svgFolder: string) {
    const fileSave = join(this.saveTo, 'README.md')
    context.group(`${chalk.green('%s %s')}`, 'Readme:', fileSave)
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileSave)
      writer.once('finish', resolve)
      writer.once('error', reject)
      writer.write(`# ${this.title}\r\n`)
      if (this.description) {
        writer.write(`__${this.description}__\r\n`)
      }
      if (this.result.teleview) {
        writer.write(readFileSync(this.result.teleview))
        writer.write('\r\n')
      }
      if (this.result.overview) {
        writer.write(readFileSync(this.result.overview))
        writer.write('\r\n')
      }
      if (this.result.clazz) {
        writer.write(readFileSync(this.result.clazz))
        writer.write('\r\n')
      }
      if (this.result.sequence) {
        writer.write(readFileSync(this.result.sequence))
        writer.write('\r\n')
      }
      writer.end()
      context.groupEnd()
    })
  }

  private removeMDInLink(cnt: string, startAt = 0) {
    return cnt.split('\r\n')
      .filter((_, i) => i >= startAt)
      .map(e => e.replace(/\.md\)(\r|\n|\s|\))*$/m, ')  '))
      .join('\r\n')
  }

  private async printGitlabWiki(_mdFolder: string, _mmdFolder: string, _svgFolder: string) {
    await Promise.all([
      // Print home.md
      new Promise((resolve, reject) => {
        const fileSave = join(this.saveTo, 'home.md')
        context.group(`${chalk.green('%s %s')}`, 'Home:', fileSave)
        const writer = createWriteStream(fileSave)
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write(`# ${this.title}\r\n`)
        writer.write('\r\n')
        if (this.description) {
          writer.write(`__${this.description}__\r\n`)
          writer.write('\r\n')
        }
        if (this.result.teleview) {
          writer.write(this.removeMDInLink(readFileSync(this.result.teleview).toString()))
          writer.write('\r\n')
        }
        if (this.result.overview) {
          writer.write(this.removeMDInLink(readFileSync(this.result.overview).toString()))
          writer.write('\r\n')
        }
        if (this.result.clazz) {
          writer.write(this.removeMDInLink(readFileSync(this.result.clazz).toString()))
          writer.write('\r\n')
        }
        if (this.result.sequence) {
          writer.write(this.removeMDInLink(readFileSync(this.result.sequence).toString()))
          writer.write('\r\n')
        }
        writer.end()
        context.groupEnd()
      }),
      // Print sidebar
      new Promise((resolve, reject) => {
        const fileSave = join(this.saveTo, '_sidebar.md')
        context.group(`${chalk.green('%s %s')}`, 'Sidebar:', fileSave)
        const writer = createWriteStream(fileSave)
        writer.once('finish', resolve)
        writer.once('error', reject)
        writer.write(`### Architecture design`)
        writer.write('\r\n')
        if (this.result.teleview) {
          writer.write(`- [Overview](overview)`)
          writer.write('\r\n')
        }
        if (this.result.overview) {
          writer.write(`- [Components & Actions](overview.details)`)
          writer.write('\r\n')
        }
        if (this.result.clazz) {
          writer.write(`- [Data model](data_model)`)
          writer.write('\r\n')
        }
        if (this.externalLinks && this.externalLinks.length) {
          this.externalLinks.forEach(link => {
            if (link && typeof link === 'object') {
              const { name, url } = link
              writer.write(`- [${name}](${url})`)
              writer.write('\r\n')
            } else {
              writer.write(link || '---')
              writer.write('\r\n')
            }
          })
        }

        if (this.result.sequence) {
          writer.write(`### Sequence diagram`)
          writer.write('\r\n')
          const cnt = this.removeMDInLink(readFileSync(this.result.sequence).toString(), 3)
          writer.write(cnt)
          writer.write('\r\n')
        }
        writer.end()
        context.groupEnd()
      })
    ])
  }

  async printAllOfTeleviews(mmdFolder: string, svgFolder: string) {
    if (this.combineOverviews?.length) {
      const fileSave = join(this.saveTo, 'SYSTEM.md')
      const fileMMDSave = join(mmdFolder, 'system.mmd')
      const fileImageSave = join(svgFolder, 'system.svg')
      context.group(`${chalk.green('%s %s')}`, 'System:', fileSave)
      await Promise.all([
        // Write mmd
        new Promise((resolve, reject) => {
          const writer = createWriteStream(fileMMDSave)
          writer.once('finish', resolve)
          writer.once('error', reject)
          const cached = new ArrayUnique()
          const cachedClassDef = new ArrayUnique()
          const cachedLineStyles = new ArrayUnique()
          const cachedObjects = {} as { [name: string]: ArrayUnique }
          cachedObjects[''] = new ArrayUnique()
          const pt = /^(\w+) ((<-.->)|(<-->)|(---)|(-.-)|(-->)|(-.->)) (\w+)$/
          const ptSubgraph = /subgraph (.+)/
          let subgraphName: string
          if (this._flowChart.defRect.services) cachedClassDef.add(`classDef Services ${this._flowChart.defRect.services}`)
          if (this._flowChart.defRect.databases) cachedClassDef.add(`classDef Databases ${this._flowChart.defRect.databases}`)
          if (this._flowChart.defRect.others) cachedClassDef.add(`classDef Others ${this._flowChart.defRect.others}`)
          if (this._flowChart.defRect.apps) cachedClassDef.add(`classDef App ${this._flowChart.defRect.apps}`)
          if (this._flowChart.defRect.clients) cachedClassDef.add(`classDef Client ${this._flowChart.defRect.clients}`)
          this.combineOverviews.forEach((f: string, i: number) => {
            const content = readFileSync(Testcase.getPathFromRoot(f)).toString().split('\n')
            content.forEach((cnt, j) => {
              const line = cnt.trim().replace(/\r|\n/g, '')
              if (!line) return
              if (j === 0) {
                if (i === 0) {
                  writer.write(line + '\r\n')
                }
                return
              }
              if (line.startsWith('linkStyle ') || line.startsWith('classDef ')) {
                return
              } else if (subgraphName || line.startsWith('subgraph ') || line.startsWith('end')) {
                const m = line.match(ptSubgraph)
                if (m) {
                  subgraphName = m[1].trim()
                  if (!cachedObjects[subgraphName]) cachedObjects[subgraphName] = new ArrayUnique()
                } else if (line === 'end') {
                  subgraphName = undefined
                } else if (subgraphName) {
                  cachedObjects[subgraphName].add(line.trim())
                }
              } else {
                const m = line.match(pt)
                let idx: number
                if (m) {
                  const last = m.length - 1
                  cachedClassDef.add(`classDef ${m[1]} ${this._flowChart.getRectColor(m[1])}`)
                  cachedClassDef.add(`classDef ${m[last]} ${this._flowChart.getRectColor(m[last])}`)
                  // if (m[1] !== m[last]) {
                  switch (m[2]) {
                    case '-.-':
                      cached.add(`${m[1]} -..- ${m[last]}`)
                      break
                    case '---':
                      cached.add(`${m[1]} ----- ${m[last]}`)
                      break
                    case '-.->':
                    case '<-.->':
                      idx = cached.findIndex(c => c === `${m[1]} <-.-> ${m[last]}`)
                      if (idx === -1) {
                        idx = cached.findIndex(c => c === `${m[last]} <-.-> ${m[1]}`)
                        if (idx === -1) {
                          idx = cached.findIndex(c => c === `${m[1]} -.-> ${m[last]}`)
                          if (idx === -1) {
                            idx = cached.findIndex(c => c === `${m[last]} -.-> ${m[1]}`)
                            if (idx !== -1) {
                              cached[idx] = `${m[1]} <-...-> ${m[last]}`
                              break
                            }
                          }
                        }
                      }
                      if (m[2] === '-.->') {
                        cached.add(`${m[1]} -...-> ${m[last]}`)
                      } else {
                        cached.add(`${m[1]} <-...-> ${m[last]}`)
                      }
                      break
                    case '-->':
                    case '<-->':
                      idx = cached.findIndex(c => c === `${m[1]} <--> ${m[last]}`)
                      if (idx === -1) {
                        idx = cached.findIndex(c => c === `${m[last]} <--> ${m[1]}`)
                        if (idx === -1) {
                          idx = cached.findIndex(c => c === `${m[1]} --> ${m[last]}`)
                          if (idx === -1) {
                            idx = cached.findIndex(c => c === `${m[last]} --> ${m[1]}`)
                            if (idx !== -1) {
                              cached[idx] = `${m[1]} <----> ${m[last]}`
                              break
                            }
                          }
                        }
                      }
                      if (m[2] === '-->') {
                        cached.add(`${m[1]} ----> ${m[last]}`)
                      } else {
                        cached.add(`${m[1]} <----> ${m[last]}`)
                      }
                      break
                  }
                  // }
                } else if (!line.startsWith('%% ')) {
                  cachedObjects[''].add(line)
                }
                // else {
                //   cached.push(line)
                // }
              }
            })
          })
          const match = {
            req2: /(.*?) <-{2,5}> /,
            req: /(.*?) -{2,5}> /,
            pubsub: /(.*?) <-\.{1,4}-> /,
            pub: /(.*?) -\.{1,4}-> /,
            call: /(.*?) -{3,6} /,
            call1: /(.*?) -.{1,3}- /,
          }
          cached.forEach((msg, i) => {
            let m = msg.match(match.req2)
            if (m) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
              // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.req2}`)
            } else {
              m = msg.match(match.req)
              if (m) {
                cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
                // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.req}`)
              } else {
                m = msg.match(match.pubsub)
                if (m) {
                  cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
                  // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.pubsub}`)
                } else {
                  m = msg.match(match.pub)
                  if (m) {
                    cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
                    // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.pub}`)
                  } else {
                    m = msg.match(match.call)
                    if (m) {
                      cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
                      // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.call}`)
                    } else {
                      m = msg.match(match.call1)
                      if (m) {
                        cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.getLineColor(m[1])}`)
                        // cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.call}`)
                      }
                    }
                  }
                }
              }
            }
          })
          writer.write(cachedClassDef.join('\r\n'))
          writer.write('\r\n')
          if (cachedObjects[''].length > 0) {
            cachedObjects[''].forEach(objName => {
              writer.write(`${objName}\r\n`)
            })
          }
          Object.keys(cachedObjects)
            .filter(subgraphName => subgraphName)
            .forEach(subgraphName => {
              if (cachedObjects[subgraphName].length > 0) {
                writer.write(`subgraph ${subgraphName}\r\n`)
                cachedObjects[subgraphName].forEach(objName => {
                  writer.write(`  ${objName}\r\n`)
                })
                writer.write(`end\r\n`)
              }
            })
          writer.write(cached.join('\r\n'))
          writer.write('\r\n')
          writer.write(cachedLineStyles.join('\r\n'))
          writer.end()
          context.groupEnd()
        }),
        // Write md
        new Promise((resolve, reject) => {
          const writer = createWriteStream(fileSave)
          writer.once('finish', resolve)
          writer.once('error', reject)
          writer.write(`### System overviews\r\n`)
          if (this.outputType === 'svg') {
            // svg
            writer.write(`![System overview](${relative(this.saveTo, fileImageSave)})\r\n`)
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
      ])
      // Generate image
      this.addImage(fileMMDSave, fileImageSave)
    }
  }

  async print() {
    if (!this.saveTo) return
    const mmdFolder = join(this.saveTo, 'resources', 'mmd')
    const svgFolder = join(this.saveTo, 'resources', 'svg')
    mkdirp.sync(mmdFolder)
    mkdirp.sync(svgFolder)
    const mdTasks = []
    let mdFolder: string
    if (this.src?.length && this.totalFiles) {
      mdFolder = join(this.saveTo, 'api_sequence_diagram')
      mkdirp.sync(mdFolder)
      await this.printSequence(mdTasks, mdFolder, mmdFolder, svgFolder)
      await this.printClasses(mdTasks, mdFolder, mmdFolder, svgFolder)
      this.result.overview = await this._flowChart.printOverviewDetails(mdTasks, mdFolder, mmdFolder, svgFolder)
      this.result.teleview = await this._flowChart.printOverview(mdTasks, mdFolder, mmdFolder, svgFolder)
    }
    if (this.combineOverviews?.length) {
      await this.printAllOfTeleviews(mmdFolder, svgFolder)
    }
    const isGenSvg = await this.genImage()
    if (isGenSvg) this.outputType = 'svg'
    if (mdTasks.length) await Promise.all(mdTasks)
    if (mdFolder) {
      if (this.template === 'gitlab.wiki') {
        await this.printGitlabWiki(mdFolder, mmdFolder, svgFolder)
      } else {
        await this.printDefaultMarkdown(mdFolder, mmdFolder, svgFolder)
      }
    }
    context.log('')
    context.log(chalk.green.bold(`Output type is ".${this.outputType}"`))
  }

}

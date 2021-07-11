import { Exec } from '@/components/external/Exec'
import { Tag } from '@/components/Tag'
import { Testcase } from '@/components/Testcase'
import { context } from "@/Context"
import chalk from 'chalk'
import { createReadStream, createWriteStream, readdirSync, readFileSync, statSync } from 'fs'
import mkdirp from 'mkdirp'
import { extname, join, relative } from 'path'
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
  /** JSON config file for mermaid */
  configFile: string
  /** CSS file for the page */
  cssFile: string
  /** JSON configuration file for puppeteer */
  puppeteerConfigFile: string
  /** Show event details */
  showEventDetails: boolean
  /** Show request details */
  showRequestDetails: boolean
  /** Run by node command */
  runOnNodeJS: boolean
  /** Concat all of teleview diagrams to summary all of services */
  combineOverviews: string[]
  /** Theme */
  theme: 'default' | 'forest' | 'dark' | 'neutral'
  _stackFrom: string
  _stackTo: string
  _nodeModulePath: string
  _genImages: { input: string, output: string }[]

  get appName() {
    return this.title?.replace(/\W+/g, '_') || 'App'
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
    if (this.showEventDetails === undefined) this.showEventDetails = true
    if (this.showRequestDetails === undefined) this.showRequestDetails = true
    if (!this.ext) this.ext = Object.keys(this.fileTypes).map(e => `.${e}`)
    if (!this.excludes) this.excludes = ['node_modules']
    this._stackFrom = this.stack ? '+' : ''
    this._stackTo = this.stack ? '-' : ''
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (!this.title) this.title = 'My Service'
    if (this.saveTo) {
      this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    }
  }

  async exec() {
    this.roots = []
    context.group(chalk.green(this.title, this.src.join(', ')))
    context.group()
    const begin = Date.now()
    await Promise.all(this.src.map(f => this.scan(f)))
    context.log()
    context.log(`- Scaned ${this.totalFiles} files in ${Date.now() - begin}ms`)
    context.log()
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
        const Clazz = Comment.getType(cnt) as typeof Comment
        let newOne = new Clazz(cnt, startC, first?.umlType)
        newOne.docSequence = this
        if (!first || first.startC === newOne.startC || first.umlType !== newOne.umlType) {
          newOne.init(true)
          first = newOne
          cur = newOne
          // newOne.root = first
          if (newOne.umlType === 'sequence') roots.push(newOne)
        } else {
          newOne.init(false)
          // newOne.root = cur.root
          const level = newOne.getLevel(cur)
          if (level === 'child') {
            let empty: EMPTY = cur
            const childLevel = (newOne.startC - cur.startC) / space.length
            new Array(childLevel - 1).fill(null).forEach((_, i) => {
              const newEmpty = new EMPTY('', empty.startC, empty.umlType)
              newEmpty.parent = empty
              newEmpty.docSequence = empty.docSequence
              newEmpty.startC = newOne.startC - (space.length * (i + 1))
              empty.childs.push(newEmpty)
              empty = newEmpty
              // empty.root = empty.parent.root
            })
            newOne.parent = empty
            // newOne.ctx = newOne.parent.ctx
            empty.childs.push(newOne)
          } else if (level === 'parent') {
            const parentLevel = (cur.startC - newOne.startC) / space.length
            let parent = cur.parent
            new Array(parentLevel).fill(null).forEach(() => {
              parent = parent.parent
            })
            newOne.parent = parent
            newOne.parent.childs.push(newOne)
          } else {
            newOne.parent = cur.parent
            cur.parent.childs.push(newOne)
          }
          if (newOne.name && !newOne.childs.length) {
            const m = newOne.name.match(/^([^<]+)((<>)|(<=>))([^:]+)([^;]+);?(.*)/)
            if (m) {
              const nextOne = newOne.clone()
              if (m[3]) {
                newOne.name = `${m[1]}>${m[5]}:${m[6]}`
                nextOne.name = `${m[1]}<${m[5]}:${m[7] || 'Return'}`
              } else if (m[4]) {
                newOne.name = `${m[1]}=>${m[5]}:${m[6]}`
                nextOne.name = `${m[1]}<=${m[5]}:${m[7] || 'Return'}`
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

  async addImage(mmdFile: string, svgFile: string) {
    this._genImages.push({ input: mmdFile, output: svgFile })
  }

  private async genImage() {
    const genImage = new Exec()
    const inputs = this._genImages.map(e => e.input).join(',')
    const outputs = this._genImages.map(e => e.output).join(',')
    const args = []
    if (this.runOnNodeJS) args.push('node')
    args.push(this._nodeModulePath, '--input', inputs, '--output', outputs)
    if (this.theme) args.push('--theme', this.theme)
    if (this.backgroundColor) args.push('--backgroundColor', this.backgroundColor)
    if (this.width) args.push('--width', this.width.toString())
    if (this.height) args.push('--height', this.height.toString())
    if (this.configFile) args.push('--configFile', Testcase.getPathFromRoot(this.configFile))
    if (this.cssFile) args.push('--cssFile', Testcase.getPathFromRoot(this.cssFile))
    if (this.puppeteerConfigFile) args.push('--puppeteerConfigFile', Testcase.getPathFromRoot(this.puppeteerConfigFile))
    genImage.init({
      // shell: true,
      // detached: true,
      slient: this.slient,
      args
    })
    await genImage.exec()
  }

  private async printSequence(mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!this.roots.length) return
    for (const root of this.roots) {
      const fileSave = join(mdFolder, root.outputName + '.md')
      const fileMMDSave = join(mmdFolder, root.outputName + '.mmd')
      const fileImageSave = join(svgFolder, root.outputName + '.svg')
      context.group(`${chalk.green('%s %s')}`, 'Diagram:', fileSave)
      await Promise.all([
        // Write mmd
        new Promise((resolve, reject) => {
          const writer = createWriteStream(fileMMDSave)
          writer.once('close', resolve)
          writer.once('error', reject)
          writer.write('sequenceDiagram\r\n')
          if (this.autoNumber) writer.write('autonumber\r\n')
          root.print(writer, 0, undefined)
          writer.close()
        }),
        // Write md
        new Promise(async (resolve, reject) => {
          const writer = createWriteStream(fileSave)
          writer.once('close', resolve)
          writer.once('error', reject)
          writer.write(`## ${root.title}\r\n`)
          writer.write(`![${root.title}](${relative(mdFolder, fileImageSave)})\r\n`)
          // writer.write('```mermaid\r\n')
          // writer.write(readFileSync(root.src))
          // writer.write('\r\n')
          root.src = fileSave
          // writer.write('```')
          writer.close()
          context.groupEnd()
        })
      ])
      // Generate image
      this.addImage(fileMMDSave, fileImageSave)
    }
    const fileSave = join(this.saveTo, 'sequence.md')
    context.group(`${chalk.green('%s %s')}`, 'Sequence diagram:', fileSave)
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileSave)
      writer.once('close', resolve)
      writer.once('error', reject)
      writer.write(`## Sequence diagram\r\n`)
      writer.write(`_Describe business logic flows in each of APIs, workers... in the service_\r\n`)
      this.roots.forEach((root, i) => {
        writer.write(`${i + 1}. [${root.title}](${relative(this.saveTo, root.src).replace(/\.md$/, '')})\r\n`)
      })
      writer.write('\r\n')
      this.result.sequence = fileSave
      writer.close()
      context.groupEnd()
    })
  }

  private async printClasses(_mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!Comment.Classes.length) return
    const fileSave = join(this.saveTo, 'data_model.md')
    const fileMMDSave = join(mmdFolder, 'data_model.mmd')
    const fileImageSave = join(svgFolder, 'data_model.svg')
    context.group(`${chalk.green('%s %s')}`, 'Data model:', fileSave)
    await Promise.all([
      /// Write mmd
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileMMDSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write('classDiagram\r\n')
        Comment.Classes.forEach((root) => {
          root.printClass(writer, 0, undefined)
        })
        writer.close()
      }),
      // Write md
      new Promise((resolve, reject) => {
        const writer = fileSave ? createWriteStream(fileSave) : null
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(`## Data model\r\n`)
        writer.write(`_Show data structure and relations between them in the service_\r\n`)
        writer.write(`![Data model](${relative(this.saveTo, fileImageSave)})\r\n`)
        writer.close()
        this.result.clazz = fileSave
        context.groupEnd()
      }),
    ])
    // Generate image
    this.addImage(fileMMDSave, fileImageSave)
  }

  private async printMarkdown(_mdFolder: string, _mmdFolder: string, _svgFolder: string) {
    const fileSave = join(this.saveTo, 'README.md')
    context.group(`${chalk.green('%s %s')}`, 'Readme:', fileSave)
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileSave)
      writer.once('close', resolve)
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
      writer.close()
      context.groupEnd()
    })
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
          writer.once('close', resolve)
          writer.once('error', reject)
          const cached = new ArrayUnique()
          const cachedLineStyles = new ArrayUnique()
          const cachedObjects = {} as { [name: string]: ArrayUnique }
          cachedObjects[''] = new ArrayUnique()
          const pt = /^(\w+) ((<-.->)|(<-->)|(---)|(-.-)|(-->)|(-.->)) (\w+)$/
          const ptSubgraph = /subgraph (.+)/
          let subgraphName: string
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
              if (subgraphName || line.startsWith('subgraph ') || line.startsWith('end')) {
                const m = line.match(ptSubgraph)
                if (m) {
                  subgraphName = m[1].trim()
                  if (!cachedObjects[subgraphName]) cachedObjects[subgraphName] = new ArrayUnique()
                } else if (line === 'end') {
                  subgraphName = undefined
                } else if (subgraphName) {
                  cachedObjects[subgraphName].add(line.trim())
                }
              } else if (line.startsWith('linkStyle ')) {
                return
              } else {
                const m = line.match(pt)
                let idx: number
                if (m) {
                  const last = m.length - 1
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
                } else if (!line.startsWith('%% ')) {
                  cachedObjects[''].add(line)
                }
                // else {
                //   cached.push(line)
                // }
              }
            })
          })
          cached.forEach((msg, i) => {
            if (/ <-{2,5}> /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.req2}`)
            } else if (/ -{2,5}> /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.req}`)
            } else if (/ <-\.{1,4}-> /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.pubsub}`)
            } else if (/ -\.{1,4}-> /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.pub}`)
            } else if (/ -{3,6} /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.call}`)
            } else if (/ -.{1,3}- /.test(msg)) {
              cachedLineStyles.push(`linkStyle ${i} ${this._flowChart.lineStyle.call}`)
            }
          })
          if (cachedObjects[''].length > 0) {
            cachedObjects[''].forEach(objName => {
              writer.write(`${objName}\r\n`)
            })
          }
          Object.keys(cachedObjects).filter(subgraphName => subgraphName).forEach(subgraphName => {
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
          writer.close()
          context.groupEnd()
        }),
        // Write md
        new Promise((resolve, reject) => {
          const writer = createWriteStream(fileSave)
          writer.once('close', resolve)
          writer.once('error', reject)
          writer.write(`### System overviews\r\n`)
          writer.write(`![System overview](${relative(this.saveTo, fileImageSave)})\r\n`)
          writer.close()
          context.groupEnd()
        })
      ])
      // Generate image
      this.addImage(fileMMDSave, fileImageSave)
    }
  }

  async print() {
    if (!this.saveTo) return
    const mdFolder = join(this.saveTo, 'api_sequence_diagram')
    const mmdFolder = join(this.saveTo, 'resources', 'mmd')
    const svgFolder = join(this.saveTo, 'resources', 'svg')
    await Promise.all([
      mkdirp(mdFolder),
      mkdirp(mmdFolder),
      mkdirp(svgFolder),
    ])
    await this.printSequence(mdFolder, mmdFolder, svgFolder)
    await this.printClasses(mdFolder, mmdFolder, svgFolder)
    this.result.overview = await this._flowChart.printOverviewDetails(mdFolder, mmdFolder, svgFolder)
    this.result.teleview = await this._flowChart.printOverview(mdFolder, mmdFolder, svgFolder)
    await Promise.all([
      this.printMarkdown(mdFolder, mmdFolder, svgFolder),
      this.printAllOfTeleviews(mmdFolder, svgFolder),
    ])
    await this.genImage()
  }

}

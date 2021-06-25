import chalk from 'chalk'
import { createReadStream, createWriteStream, readdirSync, statSync, WriteStream } from 'fs'
import { cloneDeep } from 'lodash'
import { join } from 'path'
import { createInterface } from 'readline'
import { context } from "../../Context"
import { Tag } from '../Tag'
import { Testcase } from '../Testcase'

class Group {
  static all = {}
  args: string
  tab: string
  ctx: string

  push(_k) {
    // console.log('push', _k)
    this.tab += '  '
  }

  pop(_k) {
    // console.log('pop', _k)
    this.tab = this.tab.replace(/\s\s/, '')
  }

  steps: {
    tab?: string
    key?: string
    des?: string
    log?: string
    ref?: string
    ctx?: string
    group?: Group,
    tag?: string
    args?: string
  }[]

  constructor(public ns: string, public key: string, public name: string, public isHead = false) {
    this.steps = []
    if (this.ns) this.ns += '.'
    this.key = this.ns + this.key
    this.tab = ''
  }
}

export class DocSequence extends Tag {
  static all = {}
  static steps = []
  /** Not scan in these paths */
  excludes?: string[]
  /** Only scan file with the extensions */
  ext?: string[]
  /** Root path to scan */
  src: string[]
  /** Export sequence diagram to this path */
  saveTo: string
  auto: boolean
  private runSomeCases: string[]

  private group: Group[]

  init(attrs: any) {
    super.init(attrs)
    if (!this.excludes) this.excludes = ['node_modules']
    if (!this.ext) this.ext = ['.ts', '.js', '.go', '.py', '.yaml', '.java']
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (this.saveTo) {
      this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    }
    if (!this.title) this.title = 'Comment tracer'
    this.runSomeCases = []
  }

  handleCommentFile(f: string) {
    let pattern = /\/\/\s+([\+\-#><]+\s*(.*))/i
    if (f.endsWith('.py')) {
      // python
      pattern = /#\s+([\+\-#><]+\s*(.+))/i
    }
    return {
      getMatch(line) {
        return line.match(pattern)
      }
    }
  }

  format(txt: string) {
    return this.mmdSequence(txt)
  }

  preText(txt: string, g: any) {
    return txt?.replace(/\$this/g, g.ctx || 'IMPOSSIBLE_ERROR')
  }

  preFileText(txt: string, g: any) {
    return this.preText(txt, g)?.replace(/\n/g, '<br/>')
  }

  mmdSequence(txt: string) {
    if (txt?.includes('<<--')) {
      txt = txt.replace(/\s*(.*?)\s*<<--\s*(.*?)\s*:\s*(.*)/, '$2 -->> $1 : $3')
    } else if (txt?.includes('<<-')) {
      txt = txt.replace(/\s*(.*?)\s*<<-\s*(.*?)\s*:\s*(.*)/, '$2 ->> $1 : $3')
    } else if (txt?.includes('(--')) {
      txt = txt.replace(/\s*(.*?)\s*\(--\s*(.*?)\s*:\s*(.*)/, '$2 --) $1 : $3')
    } else if (txt?.includes('(-')) {
      txt = txt.replace(/\s*(.*?)\s*\(-\s*(.*?)\s*:\s*(.*)/, '$2 -) $1 : $3')
    }
    return txt
  }

  async exec() {
    context.group(chalk.green(this.title, this.src.join(', ')))
    await Promise.all(this.src.map(f => this.scan(f)))
    this.group = this.done()
    this.print()
    context.groupEnd()
  }

  async scan(folder: string) {
    const f = statSync(folder)
    if (f.isFile()) {
      if (!this.ext || this.ext.find(e => folder.endsWith(e))) {
        await this._scan(folder)
      }
    } else if (f.isDirectory()) {
      if (!this.excludes || !this.excludes.find(e => folder.includes(e))) {
        await Promise.all(readdirSync(folder).map(f => this.scan(join(folder, f))))
      }
    }
  }

  private handleMMDSequence(line: string, group: Group, args: string, i: number) {
    let m = line.match(/\+ (IF|LOOP|PARALLEL|ALT|PAR)[:\s]*(.*)/)     // [+ if] Name is string
    if (m) {
      // ref
      m[1] = m[1]?.trim()
      const key = m[1] === 'IF' ? 'ALT' : m[1] === 'PARALLEL' ? 'PAR' : m[1]
      group.steps.push({
        args,
        tab: group.tab,
        des: key + ' ' + m[2],
        log: chalk.blue(m[1]) + ' ' + chalk.yellow(m[2]),
        tag: 'if'
      })
      group.push('begin' + i + m[1])
    } else {
      m = line.match(/\+ (END_LOOP|END_IF|ELSE_IF|ELIF|AND|END_PARALLEL|END_PAR|ELSE|END)[:\s]*(.*)/)     // [+ else] Name is number
      if (m) {
        m[1] = m[1]?.trim()
        m[2] = m[2]?.trim()
        group.pop('end' + m[1])
        const key = !m[1].includes('END') ? 'ELSE' : 'END'
        group.steps.push({
          args,
          tab: group.tab,
          des: key + ' ' + m[2],
          log: chalk.blue(m[1]) + ' ' + chalk.yellow(m[2]),
          tag: m[1]
        })
        if (key !== 'END') {
          group.push(m[1] + i)
        }
      } else {
        m = line.match(/\+ (NOTE_RIGHT|NOTE_LEFT|NOTE_OVER|NOTE)\s*([^\:]+)?[:\s]*(.*)/)     // [+ else] Name is number
        if (m) {
          m[1] = m[1]?.trim()
          m[2] = m[2]?.trim()
          m[3] = m[3]?.trim()
          let key = ''
          if (m[1] === 'NOTE') {
            key = 'RIGHT OF ' + group.ctx
          } else {
            key = m[1] === 'NOTE_LEFT' ? 'LEFT OF' : m[1] === 'NOTE_RIGHT' ? 'RIGHT OF' : 'OVER'
          }
          group.steps.push({
            args,
            tab: group.tab,
            des: 'NOTE ' + key + ' ' + (m[2] || '') + ': ' + m[3],
            log: `${chalk.yellow.bold('NOTE')} ` + chalk.green(m[3]),
            tag: m[1]
          })
        } else {
          m = line.match(/\- ([\w\$]+)\s*([x\->=<x\)\(]+)?\s*([\w\$]*)?:(.*)/i)     // - Service -> UserService: Get something here
          if (m) {
            m[1] = m[1]?.trim()
            m[2] = m[2]?.trim()
            m[3] = m[3]?.trim()
            m[4] = m[4]?.trim()
            let dir = '->>'
            let isBack = false
            if (m[2] === '->') {
              dir = '-->>'
            } else if (m[2] === '<-') {
              dir = '<<--'
              isBack = true
            } else if (m[2] === '>') {
              dir = '->>'
            } else if (m[2] === '<') {
              dir = '<<--'
              isBack = true
            } else if (m[2] === '=>') {
              dir = '-)'
            } else if (m[2] === '<=') {
              dir = '(--'
              isBack = true
            } else if (m[2] === 'x>') {
              dir = '-x'
            } else if (m[2] === '<x') {
              dir = '--x'
              isBack = true
            }
            if (m[3]) {
              group.steps.push({
                args,
                tab: group.tab,
                des: `${m[1]} ${dir} ${m[3]}: ${m[4]}`,
                log: `${chalk.magenta(m[1])} ${chalk[isBack ? 'red' : 'green'](m[2])} ${chalk.magenta(m[3])}: ${m[4]}`,
                tag: ''
              })
            } else {
              group.steps.push({
                args,
                tab: group.tab,
                des: `${m[1]} ${dir} ${m[1]}: ${m[4]}`,
                log: `${chalk.magenta(m[1])}: ${m[4]}`,
                tag: ''
              })
            }
          } else {
            m = line.match(/\-\s+(.+)/i)     // - Service -> UserService: Get something here
            if (m) {
              m[1] = m[1].trim()
              if (m[1]) {
                group.steps.push({
                  args,
                  tab: group.tab,
                  des: `$this ->> $this: ${m[1]}`,
                  log: `${chalk.magenta('$this')}: ${m[1]}`,
                  tag: ''
                })
              }
            }
          }
        }
      }
    }
    return !!m
  }

  private _scan(file: string) {
    return new Promise((resolve, reject) => {
      try {
        const rl = createInterface({ input: createReadStream(file) });
        let group: Group
        let ns = ''
        const commentType = this.handleCommentFile(file)
        let i = 0
        rl.on('line', (line) => {
          i++
          let m = commentType.getMatch(line)
          if (!m || !m[1]) return
          line = m[1].trim()
          m = line.match(/^>\s?([^\$]*)(\$(\w+))?/i) // > functionName
          if (m) {
            // group
            m[1] = m[1]?.trim()
            m[3] = m[3]?.trim()
            if (m[1]) {
              if (group) throw new Error(`Not end function "${group.key}" yet`)
              if (m[1][0] === '>') {            // >> startup functionName
                m[1] = m[1].substr(1).trim()
                const isRunIt = m[1][0] === '>'
                if (isRunIt) {
                  m[1] = m[1].substr(1).trim()
                }
                group = new Group(ns, m[1], '', true)
                group.ctx = m[3]
                // group.push('open' + i + m[1])
                if (isRunIt) {
                  this.runSomeCases.push(group.key)
                }
              } else {
                group = new Group(ns, m[1], '')
                // group.ctx = m[3]
              }
            } else {                            // > End function
              // if (group.isHead) group.pop('close' + i + m[1])
              if (DocSequence.all[group.key]) throw new Error(`Duplicate group ${group?.key}`)
              DocSequence.all[group.key] = group
              group = undefined
            }
          } else {
            m = line.match(/^< ([^\(\$)]+)(\$(\w+))?(\(.*?\))?/i)     // [< functionName] Call functionName
            if (m) {
              // ref
              m[1] = m[1]?.trim()
              m[3] = m[3]?.trim()
              m[4] = m[4]?.trim()
              group.steps.push({
                tab: group.tab,
                des: '',
                ctx: m[3],
                args: m[4],
                ref: m[1],
                tag: '<'
              })
              // group.push(m[1])
            } else {
              m = line.match(/# (.+)/i)
              if (m) {
                ns = m[1].trim()
              } else {
                m = line.match(/([\+\-]) (\(\w+\))(.*)/i)
                let ns = undefined
                if (m) {
                  ns = m[2].trim() || undefined
                  line = `${m[1]} ${m[3].trim()}`
                }
                this.handleMMDSequence(line, group, ns, i)
              }
            }
          }
        })
        rl.on('close', () => {
          resolve(undefined)
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  private done() {
    let heads: Group[] = Object.keys(DocSequence.all).map(k => DocSequence.all[k]).filter(e => e.isHead)
    function applyRef(h: Group) {
      h.steps
        .filter(step => step.ref && !step.group)
        .forEach(step => {
          step.group = cloneDeep(DocSequence.all[step.ref] || DocSequence.all[h.ns + step.ref])
          if (!step.group) {
            throw new Error('Could not found ref ' + step.ref)
          } else {
            step.group.ctx = step.ctx
            step.group.args = step.args
            step.group.tab = step.tab + h.tab
            step.group.steps = step.group.steps.filter(s => step.group.args === undefined || s.args === undefined || step.group.args === s.args)
            step.group.steps.forEach(s => {
              if (!s.ctx) s.ctx = step.group.ctx
            })
            applyRef(step.group)
          }
        })
    }
    if (this.runSomeCases.length) {
      heads = heads.filter(g => this.runSomeCases.includes(g.key))
    }
    heads.forEach(applyRef)
    return heads
  }

  print() {
    const outGroup = (h: Group, writer: WriteStream, step: { des?: string, log?: string }, tab = '') => {
      if (!h.ctx) h.ctx = 'Service'
      const msg = this.preText(step?.log || h.name, h)
      tab = tab + h.tab
      if (msg) {
        if (!this.slient) context.log(chalk.gray(tab.replace(/\s\s/g, '| ') + '▸ ') + msg)
        if (writer) {
          const msg = this.format(this.preFileText(step.des, h))
          writer?.write(tab + msg + '\r\n')
        }
      } else {
        writer?.write('\r\n' + tab + '  %% > ' + h.key + '\r\n')
      }
      h.steps?.forEach(step => {
        if (step.group) {
          if (!step.group.ctx) step.group.ctx = h.ctx
          outGroup(step.group, writer, step, tab)
        } else {
          const tab1 = tab + '  ' + step.tab
          if (!step.ctx) step.ctx = h.ctx
          const msg = this.preText(step.log, step)
          if (!this.slient) context.log(chalk.gray(tab1.replace(/\s\s/g, '| ') + '▸ ') + msg)
          if (writer) {
            const msg = this.format(this.preFileText(step.des, step))
            writer.write(tab1 + msg + '\r\n')
          }
        }
      })
      writer?.write(tab + '  %% < ' + h.key + '\r\n\r\n')
      // context.groupEnd()
    }
    this.group.forEach(g => {
      const fileSave = this.saveTo ? join(this.saveTo, g.key.replace('$', '.') + '.mmd') : undefined
      if (fileSave) context.log(`${chalk.bold[!this.runSomeCases.length ? 'green' : 'red']('- %s')} ${chalk.gray('%s')}`, g.key, fileSave)
      const writer = fileSave ? createWriteStream(fileSave) : null
      writer?.write('sequenceDiagram\r\n')
      outGroup(g, writer, undefined)
      writer?.close()
      context.log()
    })
  }

}

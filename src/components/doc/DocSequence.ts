import { createInterface } from 'readline'
import { createReadStream, readdirSync, statSync, createWriteStream, WriteStream } from 'fs'
import { join, dirname } from 'path'
import { Tag } from '../Tag'
import { Testcase } from '../Testcase'
import { context } from "../../Context";
import chalk from 'chalk'
import { cloneDeep } from 'lodash'

class Group {
  static all = {}
  args: string
  _tab = []

  push(_k) {
    this._tab.push('  ')
  }

  pop(_k) {
    this._tab.pop()
  }

  get tab() {
    return this._tab.join('')
  }

  steps: {
    tab?: string
    key?: string
    des?: string
    log?: string
    ref?: string
    group?: Group,
    tag?: string
    args?: string
  }[]

  constructor(public ns: string, public key: string, public name: string, public isHead = false) {
    this.steps = []
    if (this.ns) this.ns += '.'
    this.key = this.ns + this.key
  }
}

export class DocSequence extends Tag {
  static all = {}
  static steps = []
  excludes?: string[]
  ext?: string[]
  src: string[]
  saveTo: string
  auto: boolean

  group: Group[]

  constructor(attrs: DocSequence) {
    super(attrs)
    if (!this.excludes) this.excludes = ['node_modules']
    if (!this.ext) this.ext = ['.ts', '.js', '.go', '.py', '.yaml', '.java']
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (this.saveTo) this.saveTo = dirname(Testcase.getPathFromRoot(this.saveTo))
    if (!this.title) this.title = 'Comment tracer'
  }

  handleCommentFile(f: string) {
    let pattern = /\/\/\s+(.+)/i
    if (f.endsWith('.py')) {
      // python
      pattern = /#\s+(.+)/i
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

  private handleMMDSequence(line: string, group: Group, args: string) {
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
      group.push(m[1])
    } else {
      m = line.match(/\+ (END_LOOP|END_IF|ELSE_IF|ELIF|AND|END_PARALLEL|END_PAR|ELSE|END)[:\s]*(.*)/)     // [+ else] Name is number
      if (m) {
        m[1] = m[1]?.trim()
        m[2] = m[2]?.trim()
        group.pop(m[1])
        const key = !m[1].includes('END') ? 'ELSE' : 'END'
        group.steps.push({
          args,
          tab: group.tab,
          des: key + ' ' + m[2],
          log: chalk.blue(m[1]) + ' ' + chalk.yellow(m[2]),
          tag: m[1]
        })
        if (key !== 'END') {
          group.push(m[1])
        }
      } else {
        m = line.match(/\+ (NOTE_RIGHT|NOTE_LEFT|NOTE_OVER|NOTE)\s*([^\:]+)?[:\s]*(.*)/)     // [+ else] Name is number
        if (m) {
          m[1] = m[1]?.trim()
          m[2] = m[2]?.trim()
          m[3] = m[3]?.trim()
          let key = ''
          if (m[1] === 'NOTE') {
            key = 'RIGHT OF Service'
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
          m = line.match(/\- ([\w]+)\s+([^\w]+)?([\w]*)?:(.*)/i)     // - Service -> UserService: Get something here
          if (m) {
            m[1] = m[1]?.trim()
            m[2] = m[2]?.trim()
            m[3] = m[3]?.trim()
            m[4] = m[4]?.trim()
            let dir = ''
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
                log: `${chalk.magenta(m[1])} ${chalk.gray(isBack ? 'red' : 'green')} ${chalk.magenta(m[1])}: ${m[4]}`,
                tag: ''
              })
            }
          } else {
            m = line.match(/\- (.+)/i)     // - Service -> UserService: Get something here
            if (m && m[1]) {
              m[1] = m[1].trim()
              if (m[1]) {
                group.steps.push({
                  args,
                  tab: group.tab,
                  des: `Service ->> Service: ${m[1]}`,
                  log: `${chalk.magenta('Service')}: ${m[1]}`,
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
        rl.on('line', (line) => {
          let m = commentType.getMatch(line)
          if (!m || !m[1]) return
          line = m[1].trim()
          m = line.match(/^>\s?(.*)/i) // > functionName
          if (m) {
            // group
            m[1] = m[1]?.trim()
            if (!group) {
              if (m[1][0] === '>') {            // >> startup functionName
                m[1] = m[1].substr(1).trim()
                group = new Group(ns, m[1], '', true)
                group.push(m[1])
              } else {
                group = new Group(ns, m[1], '')
              }
            } else if (!m[1]) {                            // > End function
              if (group.isHead) group.pop(m[1])
              if (DocSequence.all[group.key]) throw new Error('Duplicate group ' + group.name)
              DocSequence.all[group.key] = group
              group = undefined
            }
          } else {
            m = line.match(/^< ([^\()]+)(\(.*?\))?/i)     // [< functionName] Call functionName
            if (m) {
              // ref
              m[1] = m[1]?.trim()
              m[2] = m[2]?.trim()
              group.steps.push({
                tab: group.tab,
                des: '',
                args: m[2],
                ref: m[1],
                tag: '<'
              })
              // group.push(m[1])
            } else {
              m = line.match(/@ (.+)/i)
              if (m) {
                ns = m[1].trim()
              } else {
                m = line.match(/([\+\-]) (\(\w+\))(.*)/i)
                let ns = undefined
                if (m) {
                  ns = m[2].trim() || undefined
                  line = `${m[1]} ${m[3].trim()}`
                }
                this.handleMMDSequence(line, group, ns)
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
    const heads: Group[] = Object.keys(DocSequence.all).map(k => DocSequence.all[k]).filter(e => e.isHead)
    function applyRef(h: Group) {
      console.log(h.args, h.steps.map(e => e.args))
      h.steps
        .filter(step => step.ref && !step.group)
        .forEach(step => {
          step.group = cloneDeep(DocSequence.all[step.ref] || DocSequence.all[h.ns + step.ref])
          if (!step.group) {
            throw new Error('Could not found ref ' + step.ref)
          } else {
            step.group.args = step.args
            step.group.steps = step.group.steps.filter(s => step.group.args === undefined || s.args === undefined || step.group.args === s.args)
            applyRef(step.group)
          }
        })
    }
    heads.forEach(applyRef)
    return heads
  }

  print() {
    const outGroup = (h: Group, writer: WriteStream, step: { des?: string, log?: string }, tab = '') => {
      const msg = step?.log || h.name
      tab = tab + h.tab
      if (msg) {
        context.log(tab + chalk.gray('↳ ') + msg)
        if (writer) {
          const msg = this.format(step.des)
          writer?.write(tab + msg + '\r\n')
        }
      } else {
        writer?.write('\r\n' + tab + '  %% > ' + h.key + '\r\n')
      }
      tab += '  '
      h.steps?.forEach(step => {
        if (step.group) {
          outGroup(step.group, writer, step, tab)
        } else {
          const msg = step.log
          context.log(tab + step.tab + chalk.gray('↳ ') + msg)
          if (writer) {
            const msg = this.format(step.des)
            writer.write(tab + step.tab + msg + '\r\n')
          }
        }
      })
      writer?.write(tab + '%% < ' + h.key + '\r\n\r\n')
      // context.groupEnd()
    }
    if (this.saveTo) context.group(chalk.magentaBright('- %s'), chalk.bold(this.title))
    this.group.forEach(g => {
      const fileSave = this.saveTo ? join(this.saveTo, g.key + '.mmd') : undefined
      const writer = fileSave ? createWriteStream(fileSave) : null
      writer?.write('sequenceDiagram\r\n')
      outGroup(g, writer, undefined)
      writer?.close()
      if (writer) context.log(chalk.magentaBright('- %s'), fileSave)
    })
    if (this.saveTo) context.groupEnd()
  }

}

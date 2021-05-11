import { createInterface } from 'readline'
import { createReadStream, readdirSync, statSync, createWriteStream } from 'fs'
import { join } from 'path'
import { Tag } from '../Tag'
import { Testcase } from '../Testcase'
import { context } from "../../Context";
import chalk from 'chalk'

class Group {
  static all = {}
  private static _tab = []

  push() {
    Group._tab.push('  ')
  }

  pop() {
    Group._tab.pop()
  }

  get tab() {
    return Group._tab.join('')
  }

  steps: {
    tab?: string
    key?: string
    des?: string
    ref?: string
    group?: Group,
    tag?: string
  }[]

  constructor(public ns: string, public key: string, public name: string, public isHead = false) {
    this.steps = []
    if (this.ns) this.ns += '.'
    this.key = this.ns + this.key
  }
}

export class CommentTracer extends Tag {
  static all = {}
  static steps = []
  excludes?: string[]
  type?: 'mmd:sequence'
  ext?: string[]
  src: string[]
  saveTo: string

  group: Group[]

  constructor(attrs: CommentTracer) {
    super(attrs)
    if (!this.excludes) this.excludes = ['node_modules']
    if (!this.ext) this.ext = ['.ts', '.js', '.go', '.py', '.yaml']
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (this.saveTo) this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    if (!this.title) this.title = 'Comment tracer'
  }

  format(txt: string) {
    return this.type === 'mmd:sequence' ? this.mmdSequence(txt) : txt
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
    const isSave = this.print()
    context.groupEnd()
    if (isSave) {
      context.log(chalk.magentaBright('- %s was saved at "%s"'), chalk.bold(this.title), this.saveTo)
    }
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

  private handleMMDSequence(line: string, group: Group) {
    let m = line.match(/\[\+ (if|loop|parallel|alt|par)\](.*)/i)     // [+ if] Name is string
    if (m) {
      // ref
      m[1] = m[1]?.trim().toUpperCase()
      m[1] = m[1] === 'ALT' ? 'IF' : m[1] === 'PARALLEL' ? 'PAR' : m[1]
      group.steps.push({
        tab: group.tab,
        des: (m[1] == 'IF' ? 'ALT ' : `${m[1]} `) + m[2],
        tag: 'if'
      })
      group.push()
    } else {
      m = line.match(/\[\+ (else|end|and)\](.*)/i)     // [+ else] Name is number
      if (m) {
        group.pop()
        m[1] = m[1]?.trim()
        m[2] = m[2]?.trim()
        group.steps.push({
          tab: group.tab,
          des: m[1].toUpperCase() + ' ' + m[2],
          tag: m[1]
        })
        if (m[1].toUpperCase() !== 'END') group.push()
      } else {
        m = line.match(/\[\+ (note_right|note_left|note_over):([^\]]+)\](.*)/i)     // [+ else] Name is number
        if (m) {
          m[1] = m[1]?.trim()
          m[2] = m[2]?.trim()
          m[3] = m[3]?.trim()
          group.steps.push({
            tab: group.tab,
            des: 'Note ' + (m[1] === 'NOTE_LEFT' ? 'left of ' : m[1] === 'NOTE_RIGHT' ? 'right of ' : 'over ') + m[2] + ': ' + m[3],
            tag: m[1]
          })
        } else {
          m = line.match(/\[\+ ([^\s]+)\s?([^\s]+)?([^\]]*)?\](.*)/i)     // [+ Service -> UserService] Get something here
          if (m) {
            m[1] = m[1]?.trim()
            m[2] = m[2]?.trim()
            m[3] = m[3]?.trim()
            m[4] = m[4]?.trim()
            let dir = '->>'
            if (m[2] === '->') {
              dir = '-->>'
            } else if (m[2] === '<-') {
              dir = '<<--'
            } else if (m[2] === '>') {
              dir = '->>'
            } else if (m[2] === '<') {
              dir = '<<--'
            } else if (m[2] === '=>') {
              dir = '-)'
            } else if (m[2] === '<=') {
              dir = '(--'
            }
            if (m[3]) {
              group.steps.push({
                tab: group.tab,
                des: `${m[1]} ${dir} ${m[3]}: ${m[4]}`,
                tag: ''
              })
            } else {
              group.steps.push({
                tab: group.tab,
                des: `${m[1]} ${dir} ${m[1]}: ${m[4]}`,
                tag: ''
              })
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
        rl.on('line', (line) => {
          let m = line.match(/\[>(.*?)]/i) // [> functionName]
          if (m) {
            // group
            m[1] = m[1]?.trim()
            if (!group) {
              if (m[1][0] === '>') {            // [>> functionName]
                m[1] = m[1].substr(1).trim()
                group = new Group(ns, m[1], '', true)
              } else {
                group = new Group(ns, m[1], '')
              }
              group.push()
            } else {                            // [>] End function
              group.pop()
              if (CommentTracer.all[group.key]) throw new Error('Duplicate group ' + group.name)
              CommentTracer.all[group.key] = group
              group = undefined
            }
          } else {
            m = line.match(/\[<(.*?)\](.*)/i)     // [< functionName] Call functionName
            if (m) {
              // ref
              m[1] = m[1]?.trim()
              m[2] = m[2]?.trim()
              group.steps.push({
                tab: group.tab,
                des: m[2],
                ref: m[1],
                tag: '<'
              })
              group.push()
            } else {
              m = line.match(/\[-\](.*)/i)
              if (m) {
                group.steps.push({
                  tab: group.tab,
                  des: m[1].trim(),
                  tag: '-'
                })
              } else {
                if (this.type === 'mmd:sequence') {
                  const isHandle = this.handleMMDSequence(line, group)
                  if (!isHandle && !ns) {
                    m = line.match(/\[(\w+)\]/i)
                    if (m) {
                      ns = m[1].trim()
                    }
                  }
                }
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
    const heads: Group[] = Object.keys(CommentTracer.all).map(k => CommentTracer.all[k]).filter(e => e.isHead)
    function applyRef(h: Group) {
      h.steps.filter(step => step.ref && !step.group).forEach(step => {
        step.group = CommentTracer.all[step.ref] || CommentTracer.all[h.ns + step.ref]
        if (!step.group) {
          throw new Error('Could not found ref ' + step.ref)
        } else {
          applyRef(step.group)
        }
      })
    }
    heads.forEach(applyRef)
    return heads
  }

  print() {
    const writer = this.saveTo ? createWriteStream(this.saveTo) : null
    writer?.write('sequenceDiagram\r\n')
    const outGroup = (h: Group, des: string, tab = '') => {
      let msg = this.format(des || h.name)
      if (msg) {
        context.group(h.tab + '↳ ' + msg)
        writer?.write(tab + h.tab + msg + '\r\n')
      } else {
        context.group('')
        writer?.write('\r\n')
      }
      tab += '  '
      h.steps?.forEach(step => {
        if (step.group) {
          outGroup(step.group, step.des, tab)
        } else {
          const msg = this.format(step.des)
          context.log(step.tab + '↳ ' + msg)
          writer?.write(tab + step.tab + msg + '\r\n')
        }
      })
      context.groupEnd()
    }
    this.group.forEach(g => outGroup(g, undefined))
    writer?.close()
    return !!writer
  }

}

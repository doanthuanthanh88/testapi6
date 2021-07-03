import chalk from 'chalk'
import { createReadStream, createWriteStream, readdirSync, readFileSync, statSync } from 'fs'
import mkdirp from 'mkdirp'
import { extname, join, relative } from 'path'
import * as readline from 'readline'
import { context } from "../../Context"
import { Exec } from '../external/Exec'
import { Tag } from '../Tag'
import { Testcase } from '../Testcase'

/**
 * Example
    /// box rgb(0, 255, 0)
    ///   loop
    ///     print all
    ///       print data

    /// parallel 
    ///   get user
    ///     {} ->> {UserCore}: Get user information
    ///   get relation
    ///     {} ->> {Relation}: Get user relation

    /// if a
    ///   {} ->> {}: Do a
    /// else b
    ///   {} ->> {}: Do b
    /// else
    ///   note right of {redis}: Hello you
    ///   {} ->> {}: Do c
 */

class Comment {
  static Comments = new Map<string, Comment>()
  static Classes = new Array<Comment>()
  docSequence: DocSequence
  src: string
  key: string
  childs: Array<Comment | any>
  outputName: string
  title: string
  refs: boolean
  cmd: string
  type: string
  _startC: number
  parent: Comment
  relations: string[]
  umlType: 'sequence' | 'class'

  private _ctx: string

  set ctx(ctx: string) {
    this._ctx = ctx
  }

  get ctx() {
    return this._ctx || this.parent?.ctx
  }

  set startC(c: number) {
    if (this._startC !== undefined && this._startC !== c) {
      const addMore = c - this._startC
      this.childs.forEach((child: Comment) => {
        child.startC = child.startC + addMore
      })
    }
    this._startC = c
  }

  get startC() {
    return this._startC
  }

  clone(): Comment {
    return Object.create(this)
  }

  cloneNew(): Comment {
    const newEmpty = Object.create(this)
    newEmpty.parent = this
    newEmpty.childs = []
    newEmpty.name = ''
    newEmpty.key = ''
    newEmpty.cmd = ''
    return newEmpty
  }

  static getType(name: string) {
    const m = name.match(/^(if|else|loop|parallel|box)(\s+(.+))?/i)
    if (m) {
      const clazz = (m[1] || '').trim().toUpperCase()
      switch (clazz) {
        case 'LOOP':
          return LOOP
        case 'IF':
          return IF
        case 'ELSE':
          return ELSE
        case 'BOX':
          return BOX
        case 'PARALLEL':
          return PARALLEL
      }
    }
    return Comment
  }

  constructor(public name: string, startC: number, firstUmlType: string) {
    this.relations = []
    this.startC = startC
    this.childs = []
    let m = this.name.match(/^\[(.*?)\]\s*(\{([^\}]+)\})?(.*)/)
    if (m) {
      // template and root sequence diagram
      this.key = m[1].trim()
      this.umlType = 'sequence'
      const ctx = m[3]?.trim()
      if (ctx) this.ctx = ctx
      this.name = m[4].trim()
    } else {
      m = this.name.match(/^<(.*?)>\s*(.*)/)
      if (m) {
        // Class diagram
        const className = m[1].trim()
        const des = m[2].trim()
        this.key = className
        this.name = des
        this.umlType = 'class'
        Comment.Classes.push(this)
      } else {
        if (!this.umlType) {
          this.umlType = firstUmlType as any
        }
        if (this.umlType === 'sequence') {
          // sequence diagram
          m = this.name.match(/^(if|else|loop|parallel|box)(\s+(.+))?/i)
          if (m) {
            this.cmd = (m[1] || '').trim().toUpperCase()
            this.name = (m[3] || '').trim()
          }
        } else {
          m = this.name.match(/^\s*([^\s\:]+)([^\:]+)?(\:(.*))?/)
          if (m) {
            const field = m[1]?.trim() || ''
            const type = m[2]?.trim() || ''
            const des = m[4]?.trim() || ''
            this.key = field
            this.name = des
            this.type = type
          }
        }
      }
    }
  }

  init(isRoot: boolean) {
    if (this.umlType === 'sequence') {
      if (isRoot) {
        if (this.key) {
          Comment.Comments.set(this.key, this)
        } else {
          this.title = this.name
          this.outputName = this.name.replace(/\W/g, '_').replace(/_+/g, '_')
          if (!this.ctx) {
            this.ctx = 'app'
          } else {
            this.ctx = this.ctx.split(',').map(e => e.trim()).join(' / ')
          }
          // const newNote = this.cloneNew()
          // newNote.name = `NOTE RIGHT OF {}: ${this.name}`
          // this.childs.push(newNote)
          this.name = ''
        }
      } else if (this.key) {
        this.refs = true
      }
    }
  }

  mmdSequence(txt: string) {
    if (/^note [^:]+:(.+)/i.test(txt)) {
      let m = txt.match(/^\s*note\s((right of)|(left of)|(over))\s+([^,\:]+)\s*(,\s*(.*?))?(\:.+)/i)
      if (m) {
        if (m[2] || m[3]) {
          m[5] = Actor.getActor(m[5].replace(/\{\}/g, `{${this.ctx || 'IMPOSSIBLE_ERROR'}}`), true).name
        } else if (m[4] && m[7]) {
          m[5] = Actor.getActor(m[5].replace(/\{\}/g, `{${this.ctx || 'IMPOSSIBLE_ERROR'}}`), true).name
          m[7] = Actor.getActor(m[7].replace(/\{\}/g, `{${this.ctx || 'IMPOSSIBLE_ERROR'}}`), true).name
        }
      }
      txt = `NOTE ${m[1].toUpperCase()} ${m[5]}${m[7] ? `, ${m[7]}` : ''}${m[8]}`
    } else {
      let m = txt.match(/\s*(.*?)\s*(->|<-|=>|<=|x>|<x|>|<)\s*(.*?):(.*)/i)
      if (m) {
        const [main, ...des] = txt.split(':')
        txt = main.replace(/\{\}/g, `{${this.ctx || 'IMPOSSIBLE_ERROR'}}`) + ':' + des.join('')
        m = txt.match(/\s*(.*?)\s*(->|<-|=>|<=|x>|<x|>|<)\s*(.*?):(.*)/i)

        m[1] = m[1]?.trim()
        m[2] = m[2]?.trim()
        m[3] = m[3]?.trim()
        m[4] = m[4]?.trim()

        // Parser actor
        let action = m[2].trim()
        const { label, dir, seqDir } = Actor.getActionName(action, m[4])
        const actor1 = Actor.getActor(dir > 0 ? m[1].trim() : m[3].trim())
        const actor2 = Actor.getActor(dir < 0 ? m[1].trim() : m[3].trim())

        if (actor1.name !== actor2.name && actor1.name && actor2.name) {
          if (!actor1.actions[actor2.name]) {
            actor1.actions[actor2.name] = new Set()
          }
          if (label) {
            actor1.actions[actor2.name].add(label)
          }
        }

        m[1] = dir > 0 ? `${actor1.name}` : `${actor2.name}`
        m[3] = dir < 0 ? `${actor1.name}` : `${actor2.name}`
        if (actor2.sign) {
          if (seqDir > 0) m[3] = actor2.sign + m[3]
          else m[1] = actor2.sign + m[1]
        } else if (actor1.sign) {
          if (seqDir > 0) m[3] = actor1.sign + m[3]
          else m[1] = actor1.sign + m[1]
        }


        if (m[2] === '->') {
          txt = `${m[1]} --) ${m[3]}: ${m[4]}`
        } else if (m[2] === '<-') {
          txt = `${m[1]} (- ${m[3]}: ${m[4]}`
        } else if (m[2] === '>') {
          txt = `${m[1]} ->> ${this.docSequence._stackFrom}${m[3]}: ${m[4]}`
        } else if (m[2] === '<') {
          txt = `${this.docSequence._stackTo}${m[1]} <<-- ${m[3]}: ${m[4]}`
        } else if (m[2] === '=>') {
          txt = `${m[1]} ->> ${this.docSequence._stackFrom}${m[3]}: ${m[4]}`
        } else if (m[2] === '<=') {
          txt = `${this.docSequence._stackTo}${m[1]} <<-- ${m[3]}: ${m[4]}`
        } else if (m[2] === 'x>') {
          txt = `${m[1]} -x ${m[3]}: ${m[4]}`
        } else if (m[2] === '<x') {
          txt = `${m[1]} x-- ${m[3]}: ${m[4]}`
        }
      } else {
        txt = `${this.ctx} ->> ${this.ctx}: ${txt}`
      }
      // else if (!/(\{[\w\$]*\})\s*(->|<-|=>|<=|x>|<x|>|<)?\s*(\{[\w\$]*\})?:(.*)/i.test(txt)) {
      //   txt = `{${this.ctx}} > {${this.ctx}}: ${txt}`
      // }
      if (txt?.includes('<<--')) {
        txt = txt.replace(/\s*(.*?)\s*<<--\s*(.*?)\s*:\s*(.*)/, '$2 -->> $1 : $3')
      } else if (txt?.includes('<<-')) {
        txt = txt.replace(/\s*(.*?)\s*<<-\s*(.*?)\s*:\s*(.*)/, '$2 ->> $1 : $3')
      } else if (txt?.includes('(--')) {
        txt = txt.replace(/\s*(.*?)\s*\(--\s*(.*?)\s*:\s*(.*)/, '$2 --) $1 : $3')
      } else if (txt?.includes('(-')) {
        txt = txt.replace(/\s*(.*?)\s*\(-\s*(.*?)\s*:\s*(.*)/, '$2 -) $1 : $3')
      } else if (txt?.includes('x--')) {
        txt = txt.replace(/\s*(.*?)\s*x--\s*(.*?)\s*:\s*(.*)/, '$2 --x $1 : $3')
      } else if (txt?.includes('x-')) {
        txt = txt.replace(/\s*(.*?)\s*x-\s*(.*?)\s*:\s*(.*)/, '$2 -x $1 : $3')
      }
    }
    return txt
  }

  prePrint(writer, _i: number, _tab: string, mtab: string): string {
    if (!this.name) {
      if (this.key) {
        writer.write(`${mtab}%% ${this.key}\r\n`)
      } else {
        writer.write(`${mtab}%% ${this.cmd || 'COMMENT'}\r\n`)
      }
    }
    if (this.name && this.childs.length) {
      return `OPT ${this.name}`
    }
    return ''
  }

  postPrint(_writer, _i: number, _tab: string, _mtab: string): string {
    if (this.name && this.childs.length) {
      return `END`
    }
    return ''
  }

  getPrint(_writer, _i: number, _tab: string, _mtab: string): string {
    if (this.childs.length) {
      return ''
    }
    return this.mmdSequence(this.name)
  }

  getLevel(newOne: Comment) {
    const i = this.startC - newOne.startC
    return i > 0 ? 'child' : i < 0 ? 'parent' : 'same'
  }

  prepare() {
    this.childs = this.childs.reduce((sum, child) => {
      if (child.refs) {
        let newOneRef = Comment.Comments.get(child.key)
        if (!newOneRef) throw new Error(`Could not found refs "${child.key}"`)
        const newOne = newOneRef.clone()
        newOne.refs = false
        newOne.parent = this
        if (child._ctx) newOne._ctx = child._ctx
        newOne.umlType = this.umlType
        newOne.startC = child.startC
        if (child.name) newOne.name = child.name
        newOne.prepare()
        sum.push(newOne)
      } else {
        child.umlType = this.umlType
        child.parent = this
        child.prepare()
        sum.push(child)
      }
      return sum
    }, [])
  }

  printChild(writer, _i: number, tab = '|-', _mtab: string) {
    this.childs.forEach((child: Comment, i: number) => {
      child.print(writer, i, tab.replace(/-/g, ' ') + '|-')
    })
  }

  printTagName() {
    if (this.key) {
      return `${chalk.magenta(this.name)}${this.name ? ' ' : ''}${chalk.italic.gray(`[${this.key}]`)}`
    }
    return this.childs.length ? chalk.magenta(this.name) : ''
  }

  print(writer, _i: number, tab = '|-') {
    this.prepare()
    const mtab = tab.replace(/\W/g, ' ')
    let color = chalk.magenta
    const nname = this.name.toLowerCase()
    if (nname.startsWith('throw')) {
      color = color.red
    } else if (nname.startsWith('return')) {
      color = color.magentaBright
    } else if (nname.startsWith('response')) {
      color = color.green
    }

    const tagName = this.printTagName()
    if (tagName && !this.docSequence.slient) context.log(chalk.gray(tab) + chalk.magenta(tagName))

    const raw = this.name
    const txt = this.getPrint(writer, _i, tab, mtab)
    if (txt && !this.key && !this.docSequence.slient) context.log(chalk.gray(tab) + color(raw))

    const preText = this.prePrint(writer, _i, tab, mtab)
    if (preText) writer.write(mtab + preText + '\r\n')

    if (txt) writer.write(mtab + txt + '\r\n')

    this.printChild(writer, _i, tab, mtab)

    const postText = this.postPrint(writer, _i, tab, mtab)
    if (postText) writer.write(mtab + postText + '\r\n')
  }

  printClass(writer, _i: number, tab = '  ') {
    this.prepare()
    const mtab = tab.replace(/\W/g, ' ')
    if (!this.type) {
      if (!this.docSequence.slient) context.log(chalk.yellow(`${tab}class ${chalk.bold(this.key)}`))
      writer.write(`${mtab}class ${this.key} {\r\n`)
      writer.write(`${mtab}${this.name ? `<<${this.name}>>` : ''}\r\n`)
    } else {
      // const m = this.type.match(/([^\[]+)((\[\])|(\{\}))?/)
      const m = this.type.match(/([^\[]+)(\[\])?/)
      if (!this.docSequence.slient) context.log(`${tab}${chalk.cyan(this.key)} ${chalk.green('<' + this.type + '>')} ${chalk.gray(this.name)}`)
      if (m) {
        let clazzType = m[2]?.trim() || ''
        let relation = ''
        const [clazz, prop] = m[1].split('.')
        const typeModel = Comment.Classes.find(k => k.key === clazz)
        if (typeModel) {
          const typeProp = prop ? typeModel.childs.find(k => k.key === prop) : null
          if (!typeProp) {
            this.type = typeModel.type
          } else {
            this.type = typeProp.type
          }
          let isRefType = false
          if (!this.type) {
            isRefType = true
            this.type = typeModel.key
            relation = `..`
          }
          this.type += clazzType
          if (clazzType === '[]') {
            if (!relation) relation = `"${this.key}" --* "${prop}"`
            this.parent.relations.push(`${this.parent.key} ${relation} ${clazz}: ${isRefType ? `${this.key}` : '1..n'}`)
          } else {
            if (!relation) relation = `"${this.key}" --|> "${prop}"`
            this.parent.relations.push(`${this.parent.key} ${relation} ${clazz}: ${isRefType ? `${this.key}` : '1..1'}`)
          }
        }
      }
      let preKey = ''
      let parent = this.parent
      while (parent && parent.type) {
        preKey = ' ..' + ' ' + preKey
        parent = parent.parent
      }
      writer.write(`${mtab}+${preKey}${this.key} ~${this.type}~ : ${this.name?.replace(/\W/g, '_') || this.key}\r\n`)
    }
    this.childs.forEach((child, i) => {
      child.printClass(writer, i, tab + '  ')
    })
    if (!this.type) {
      writer.write(`${mtab}}\r\n`)
      writer.write(`${this.relations.join('\r\n')}\r\n`)
    }
  }
}

class EMPTY extends Comment {

}

class PARALLEL extends Comment {

  override prePrint() {
    let name = this.name
    if (!name && this.childs[0]?.childs.length && !this.childs[0].cmd) {
      name = this.childs[0].name
      this.childs[0].name = ''
    }
    return `PAR ${name}`
  }

  override postPrint() {
    return 'END'
  }

  printChild(writer, _i: number, tab: string, mtab: string) {
    this.childs.forEach((child: Comment, i: number) => {
      if (i > 0) {
        let name = ''
        if (!child.cmd) {
          name = child.name
          child.name = ''
        }
        writer.write(mtab + `AND ${name}` + '\r\n')
      }
      child.print(writer, i, tab.replace(/-/g, ' ') + '|-')
    })
  }

}

class LOOP extends Comment {

  override prePrint() {
    let name = this.name
    if (!name && this.childs.length === 1 && !this.childs[0].cmd) {
      name = this.childs[0].name
      this.childs[0].name = ''
    }
    return `LOOP ${name}`
  }

  override postPrint() {
    return 'END'
  }

  override printTagName() {
    return `${chalk.blue('LOOP')} ${this.name}`
  }

}

class BOX extends Comment {

  override prePrint() {
    return `RECT ${this.name}`
  }

  override postPrint() {
    return 'END'
  }

  override printTagName() {
    return `${chalk.blue('BOX')} ${this.name}`
  }

}

class IF extends Comment {

  override prePrint() {
    return `ALT ${this.name}`
  }

  override postPrint(_writer, _i: number, _tab: string, _mtab: string) {
    const idx = this.parent.childs.findIndex(child => child === this)
    if (this.parent.childs[idx + 1] instanceof ELSE) {
      return ''
    }
    return 'END'
  }

  override printTagName() {
    return `${chalk.blue('IF')} ${this.name}`
  }

}

class ELSE extends IF {

  override prePrint() {
    return `ELSE ${this.name}`
  }

  override printTagName() {
    return `${chalk.blue('ELSE')} ${this.name}`
  }

}

class Actor {
  static slient: boolean
  static actors = {} as Actor[]
  static declare = new Set()
  actions = {} as { [actor: string]: Set<string> }
  sign: '+' | '-' | ''

  constructor(public name: string) { }

  static getActionName(action: string, des: string) {
    switch (action) {
      case '=>':
      case 'x>':
        return {
          seqDir: 1,
          dir: 1,
          label: '-->|' + des.replace(/"/g, "'") + '|'
        }
      case '<x':
      case '<=':
        return {
          seqDir: -1,
          dir: -1,
          label: ''
        }
      case '->':
        return {
          seqDir: 1,
          dir: 1,
          label: '-.->|' + des.replace(/"/g, "'") + '|'
        }
      case '<-':
        return {
          seqDir: -1,
          dir: -1,
          label: '-.->|' + des.replace(/"/g, "'") + '|'
        }
      case '>':
        return {
          seqDir: 1,
          dir: 1,
          label: '---'
        }
      case '<':
        return {
          seqDir: -1,
          dir: 1,
          label: '---'
        }
    }
    return {}
  }

  static getActor(name: string, onlyGet = false) {
    const m = name.match(/\s*([\(\[<\{})]{1,2})?([^\(\[<\)\]\{\}>)]+)([\)\]\}>)]{1,2})?/)
    let sign = ''
    if (m) {
      name = m[2]
      const m1 = m[2].match(/^([\+\-])?(.+)/)
      name = m1[2].trim()
      sign = (m1[1] || '')
      if (!onlyGet) {
        if (m[1] && m[3]) {
          // if (m[1] === '((' && m[3] === '))') {
          //   Actor.declare.add(`${name}((${m[2]}))`)
          // }
          // if (m[1] === '[[' && m[3] === ']]') {
          //   Actor.declare.add(`${name}[[${m[2]}]]`)
          // } else 
          if (m[1] === '{' && m[3] === '}') {
            name.split('/').forEach(name => Actor.declare.add(`${name.trim()}`))
          } else if (m[1] === '[' && m[3] === ']') {
            name.split('/').forEach(name => Actor.declare.add(`${name.trim()}[(${m[2]})]`))
          } else if (m[1] === '(' && m[3] === ')') {
            name.split('/').forEach(name => Actor.declare.add(`${name.trim()}((${m[2]}))`))
          } else {
            name.split('/').forEach(name => Actor.declare.add(`${name.trim()}${m[1]}${m[2]}${m[3]}`))
          }
        }
      }
    }
    let actor: Actor = Actor.actors[name]
    if (!actor) {
      actor = Actor.actors[name] = new Actor(name)
    }
    actor.sign = sign as any
    return actor
  }

  static save(writer: any) {
    for (const name in Actor.actors) {
      const actor = Actor.actors[name]
      for (const a in actor.actions) {
        for (const action of actor.actions[a]) {
          // const { label, dir } = Actor.getActioinName(action)
          if (name) {
            let actor1 = name // dir > 0 ? name : a
            let actor2 = a // dir < 0 ? name : a
            actor1.split('/').forEach(actor1 => {
              actor2.split('/').forEach(actor2 => {
                writer.write(`${actor1.trim()} ${action} ${actor2.trim()}\r\n`)
              })
            })
            if (!Actor.slient) context.log(`${chalk.gray('-')} ${chalk.magenta(actor1)} ${chalk.blue(action)} ${chalk.magenta(actor2)}`)
          }
        }
      }
    }
  }
}

export class DocSequence extends Tag {
  /** Not scan in these paths */
  excludes?: string[]
  /** Only scan file with the extensions */
  ext?: string[]
  /** Root path to scan */
  src: string[]
  /** Export sequence diagram to this path */
  saveTo: string
  /** Auto generate number in sequence diagram */
  autoNumber: boolean
  /** Activations can be stacked for same actor */
  stack: boolean
  theme: 'default' | 'forest' | 'dark' | 'neutral'
  _stackFrom: string
  _stackTo: string
  _nodeModulePath: string
  _genImages: Promise<any>[]

  private totalFiles = 0
  private roots = [] as Comment[]
  private result = {
    clazz: '',
    overview: '',
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
    try {
      this._nodeModulePath = require.resolve('@mermaid-js/mermaid-cli/index.bundle')
    } catch {
      this._nodeModulePath = require.resolve('@mermaid-js/mermaid-cli/index')
    }
    if (!this.theme) this.theme = 'default'
    if (!this.ext) this.ext = Object.keys(this.fileTypes).map(e => `.${e}`)
    if (!this.excludes) this.excludes = ['node_modules']
    if (this.autoNumber === undefined) this.autoNumber = false
    if (this.stack === undefined) this.stack = false
    this._stackFrom = this.stack ? '+' : ''
    this._stackTo = this.stack ? '-' : ''
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (!this.title) this.title = 'Comment sequence diagram'
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
    let space = ''
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

  private async printOverview(_mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!Object.keys(Actor.actors).length) return
    const fileSave = join(this.saveTo, 'overview.md')
    const fileMMDSave = join(mmdFolder, 'overview.mmd')
    const fileImageSave = join(svgFolder, 'overview.svg')
    context.group(`${chalk.green('%s %s')}`, 'Overview:', fileSave)
    await Promise.all([
      // Write mmd
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileMMDSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write('graph LR\r\n')
        if (Actor.declare.size) writer.write(Array.from(Actor.declare).join('\r\n') + '\r\n')
        Actor.slient = this.slient
        Actor.save(writer)
        writer.close()
        this.result.overview = fileSave
      }),
      // Write md
      new Promise((resolve, reject) => {
        const writer = createWriteStream(fileSave)
        writer.once('close', resolve)
        writer.once('error', reject)
        writer.write(`## Service overview\r\n`)
        writer.write(`_Show all of components in the service and describe the ways they connect to each others_\r\n`)
        writer.write(`![](${relative(this.saveTo, fileImageSave)})\r\n`)
        writer.close()
        context.groupEnd()
      })
    ])
    // Generate image
    await this.genImage(fileMMDSave, fileImageSave)
  }

  private async genImage(mmdFile: string, svgFile: string) {
    const genImage = new Exec()
    genImage.init({
      shell: true,
      detached: true,
      slient: true,
      args: [this._nodeModulePath, '-i', mmdFile, '-o', svgFile, '-t', this.theme]
    })
    this._genImages.push(genImage.exec())
  }

  private async printSequence(mdFolder: string, mmdFolder: string, svgFolder: string) {
    if (!this.roots.length) return
    for (const root of this.roots) {
      const fileSave = join(mdFolder, root.outputName + '.sequence.md')
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
          writer.write(`![](${relative(mdFolder, fileImageSave)})\r\n`)
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
      await this.genImage(fileMMDSave, fileImageSave)
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
        writer.write(`${i + 1}. [${root.title}](${relative(this.saveTo, root.src)})\r\n`)
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
        writer.write(`![](${relative(this.saveTo, fileImageSave)})\r\n`)
        writer.close()
        this.result.clazz = fileSave
        context.groupEnd()
      }),
    ])
    // Generate image
    await this.genImage(fileMMDSave, fileImageSave)
  }

  private async printMarkdown(_mdFolder: string, _mmdFolder: string, _svgFolder: string) {
    const fileSave = join(this.saveTo, 'README.md')
    context.group(`${chalk.green('%s %s')}`, 'Readme:', fileSave)
    await new Promise((resolve, reject) => {
      const writer = createWriteStream(fileSave)
      writer.once('close', resolve)
      writer.once('error', reject)
      writer.write(`# ${this.title}\r\n`)
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

  async print() {
    if (!this.saveTo) return
    const mdFolder = join(this.saveTo, 'md')
    const mmdFolder = join(this.saveTo, 'mmd')
    const svgFolder = join(this.saveTo, 'svg')
    await Promise.all([
      mkdirp(mdFolder),
      mkdirp(mmdFolder),
      mkdirp(svgFolder),
    ])
    await this.printSequence(mdFolder, mmdFolder, svgFolder)
    await this.printClasses(mdFolder, mmdFolder, svgFolder)
    await this.printOverview(mdFolder, mmdFolder, svgFolder)
    await Promise.all([
      this.printMarkdown(mdFolder, mmdFolder, svgFolder),
      ...this._genImages
    ])
  }

}

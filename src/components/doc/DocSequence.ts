import chalk from 'chalk'
import { createReadStream, createWriteStream, readdirSync, statSync } from 'fs'
import { extname, join } from 'path'
import * as readline from 'readline'
import { context } from "../../Context"
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
  root: DocSequence
  key: string
  childs: Array<Comment | any>
  runnable: boolean
  refs: boolean
  ctx: string
  cmd: string
  startC: number
  parent: Comment

  clone() {
    return Object.create(this, {})
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

  constructor(public name: string, startC: number) {
    this.startC = startC
    this.childs = []
  }

  init(isRoot: boolean) {
    let m = this.name.match(/^\[(.*?)\]\s*(\{([^\}]+)\})?(.*)/)
    if (m) {
      this.key = m[1].trim()
      const ctx = m[3]?.trim()
      if (ctx) this.ctx = ctx
      this.name = m[4].trim()
      if (isRoot) {
        if (this.key) {
          Comment.Comments.set(this.key, this)
        } else {
          this.runnable = true
        }
      } else {
        this.refs = true
      }
    } else {
      m = this.name.match(/^(if|else|loop|parallel|box)(\s+(.+))?/i)
      if (m) {
        this.cmd = (m[1] || '').trim().toUpperCase()
        this.name = (m[3] || '').trim()
      }
    }
  }

  mmdSequence(txt: string) {
    if (/^note [^:]+:(.+)/i.test(txt)) {
      txt = txt
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
        if (m[2] === '->') {
          txt = `${m[1]} --) ${m[3]}: ${m[4]}`
        } else if (m[2] === '<-') {
          txt = `${m[1]} (- ${m[3]}: ${m[4]}`
        } else if (m[2] === '>') {
          txt = `${m[1]} ->> ${m[3]}: ${m[4]}`
        } else if (m[2] === '<') {
          txt = `${m[1]} <<-- ${m[3]}: ${m[4]}`
        } else if (m[2] === '=>') {
          txt = `${m[1]} ->> ${m[3]}: ${m[4]}`
        } else if (m[2] === '<=') {
          txt = `${m[1]} <<-- ${m[3]}: ${m[4]}`
        } else if (m[2] === 'x>') {
          txt = `${m[1]} -x ${m[3]}: ${m[4]}`
        } else if (m[2] === '<x') {
          txt = `${m[1]} x-- ${m[3]}: ${m[4]}`
        }
        // Parser actor
        const action = m[2].trim()
        const { label, dir } = Actor.getActioinName(action)
        const actor1 = Actor.getActor(dir > 0 ? m[1].trim() : m[3].trim())
        const actor2 = Actor.getActor(dir < 0 ? m[1].trim() : m[3].trim())

        if (actor1.name !== actor2.name && actor1.name && actor2.name) {
          if (!actor1.actions[actor2.name]) actor1.actions[actor2.name] = new Set()
          actor1.actions[actor2.name].add(label)
        }
      } else {
        txt = `{${this.ctx}} ->> {${this.ctx}}: ${txt}`
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
        writer?.write(`${mtab}%% ${this.key}\r\n`)
      } else {
        writer?.write(`${mtab}%% ${this.cmd || 'COMMENT'}\r\n`)
      }
    }
    if (this.name && this.childs.length) {
      return `ALT ${this.name}`
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
        // const newOne = cloneDeep(Comment.Comments.get(child.key))
        const newOne = Comment.Comments.get(child.key).clone()
        newOne.refs = false
        newOne.parent = this
        newOne.ctx = child.ctx
        newOne.startC = child.startC
        if (child.name) newOne.name = child.name
        newOne.prepare()
        sum.push(newOne)
      } else {
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
    if (tagName && !this.root.slient) context.log(chalk.gray(tab) + chalk.magenta(tagName))

    const raw = this.name
    const txt = this.getPrint(writer, _i, tab, mtab)
    if (txt && !this.key && !this.root.slient) context.log(chalk.gray(tab) + color(raw))

    const preText = this.prePrint(writer, _i, tab, mtab)
    if (preText) writer?.write(mtab + preText + '\r\n')

    if (txt) writer?.write(mtab + txt + '\r\n')

    this.printChild(writer, _i, tab, mtab)

    const postText = this.postPrint(writer, _i, tab, mtab)
    if (postText) writer?.write(mtab + postText + '\r\n')
  }
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
        writer?.write(mtab + `AND ${name}` + '\r\n')
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
  static actors = {} as Actor[]
  actions = {} as { [actor: string]: Set<string> }

  constructor(public name: string) { }

  static getActioinName(action: string) {
    switch (action) {
      case '=>':
      case 'x>':
      case '<x':
      case '<=':
        return {
          dir: 1,
          label: 'Request'
        }
      case '->':
        return {
          dir: 1,
          label: 'Publish'
        }
      case '<-':
        return {
          dir: -1,
          label: 'Consume'
        }
      case '>':
      case '<':
        return {
          dir: 1,
          label: 'Call'
        }
    }
    return {}
  }

  static getActor(name: string) {
    name = name.replace(/[\W]/g, '')
    let actor: Actor = Actor.actors[name]
    if (!actor) {
      actor = Actor.actors[name] = new Actor(name)
    }
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
            writer?.write(`${actor1} --${action}--> ${actor2}\r\n`)
            context.log(`${actor1} ${action} ${actor2}`)
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

  private totalFiles = 0
  private roots = [] as Comment[]

  static readonly fileTypes = {
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
    if (!this.ext) this.ext = Object.keys(DocSequence.fileTypes).map(e => `.${e}`)
    if (!this.excludes) this.excludes = ['node_modules']
    if (!Array.isArray(attrs.src)) this.src = [attrs.src]
    this.src = this.src.map(src => Testcase.getPathFromRoot(src))
    if (this.saveTo) {
      this.saveTo = Testcase.getPathFromRoot(this.saveTo)
    }
    if (!this.title) this.title = 'Comment sequence diagram'
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
    this.print()
    context.groupEnd()
  }

  async scan(folder: string) {
    const f = statSync(folder)
    if (f.isFile()) {
      if (!this.ext?.length || this.ext.includes(extname(folder))) {
        this.totalFiles++
        const file = folder
        const roots = await this.readFileContent(file)
        this.roots.push(...roots.filter(e => e.runnable))
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
    const fileType = DocSequence.fileTypes[extname(file).substr(1)]
    if (!fileType) {
      context.log(chalk.yellow(`- Not support file "${file}"`))
      return roots
    }
    let cur: Comment
    const pt = new RegExp(`^(\\s*)${fileType.commentTag}\\s?(\\s*)(.+)`, 'm')
    let space = ''
    for await (let line of rl) {
      let m = line.match(pt)
      if (m) {
        if (!space) space = m[1]
        m[1] += (m[2] || '')
        const startC = m[1].length
        const cnt = m[3].trim()
        const Clazz = Comment.getType(cnt) as typeof Comment
        const newOne = new Clazz(cnt, startC)
        newOne.root = this
        if (!cur || newOne.startC === space.length) {
          newOne.init(true)
          if (!newOne.ctx) newOne.ctx = 'app'
          cur = newOne
          roots.push(newOne)
        } else {
          newOne.init(false)
          const level = newOne.getLevel(cur)
          if (level === 'child') {
            newOne.parent = cur
            newOne.ctx = newOne.parent.ctx
            cur.childs.push(newOne)
          } else if (level === 'parent') {
            let parent = cur.parent
            new Array((cur.startC - newOne.startC) / space.length).fill(null).forEach(() => {
              parent = parent.parent
            })
            newOne.parent = parent
            newOne.parent.childs.push(newOne)
            newOne.ctx = newOne.parent.ctx
          } else {
            newOne.parent = cur.parent
            newOne.ctx = newOne.parent.ctx
            cur.parent.childs.push(newOne)
          }
          cur = newOne
        }
      }
    }
    return roots
  }

  print() {
    this.roots.forEach(root => {
      const fileSave = this.saveTo ? join(this.saveTo, root.name.replace(/\W/g, '_') + '.mmd') : undefined
      if (fileSave) context.log(`${chalk.green('%s %s')}`, 'Diagram:', fileSave)
      const writer = fileSave ? createWriteStream(fileSave) : null
      writer?.write('sequenceDiagram\r\n')
      root.print(writer, 0, undefined)
      writer?.close()
    })
    const fileSave = this.saveTo ? join(this.saveTo, 'summary.mmd') : undefined
    const writer = fileSave ? createWriteStream(fileSave) : null
    if (fileSave) context.log(`${chalk.green('%s %s')}`, 'Overview:', fileSave)
    writer?.write('graph LR\r\n')
    Actor.save(writer)
    writer?.close()
  }

}

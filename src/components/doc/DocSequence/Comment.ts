import { ArrayUnique } from './ArrayUnique'
import { context } from "@/Context"
import chalk from "chalk"
import { DocSequence } from "."
import { Actor } from "./Actor"
import { Testcase } from '@/components/Testcase'

export class Comment {
  static Comments = new Map<string, Comment>()
  static Classes = new Array<Comment>()
  ignore: boolean
  id: string
  docSequence: DocSequence
  src: string
  key: string
  mdLinks = []
  childs: Array<Comment | any>
  outputName: string
  title: string
  refs: boolean
  cmd: string
  type: string
  extends: string
  _startC: number
  parent: Comment
  relations: string[]
  umlType: 'sequence' | 'class'
  participants: ArrayUnique
  errors = {}

  private _client: string
  private _ctx: string

  get root() {
    let root: Comment = this
    while (root.parent) {
      root = root.parent as Comment
    }
    return root
  }

  set client(client: string) {
    this._client = client
  }

  get client() {
    return this._client || this.parent?.client
  }

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

  static getSeqType(name: string) {
    const m = name.match(/^(if|else|loop|parallel|box|group)(\s+(.+))?/i)
    if (m) {
      const clazz = (m[1] || '').trim().toUpperCase()
      const { BOX, ELSE, GROUP, IF, LOOP, PARALLEL } = require('./SeqTag')
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
        case 'GROUP':
          return GROUP
      }
    }
    return Comment
  }

  constructor(public name: string, startC: number, firstUmlType: string, parent: any) {
    this.relations = []
    this.startC = startC
    this.childs = []
    this.participants = new ArrayUnique()
    let m = this.name.match(/^\[(.*?)\]\s*(\{([^\}]+)\})?(\{([^\}]+)\})?(.*)/)
    // [functionName?]{context1, context2} title
    if (m) {
      // template and root sequence diagram
      const id = m[1].trim()
      this.key = id
      this.id = id
      this.umlType = 'sequence'
      const ctx = m[3]?.trim()
      if (ctx) {
        this.ctx = ctx
      }
      if (m[5]) this.client = m[5].trim()
      this.name = m[6].trim()
    } else {
      m = this.name.match(/^<(.*?)>\s*(.*)/)
      if (m) {
        // Class diagram
        const className = m[1].trim()
        const des = m[2].trim()
        const [key, ext] = className.split('~')
        this.key = key
        this.extends = ext
        this.name = des
        this.umlType = 'class'
        Comment.Classes.push(this)
      } else {
        if (!this.umlType) {
          this.umlType = firstUmlType as any
        }
        if (this.umlType === 'sequence') {
          // sequence diagram
          m = this.name.match(/^(ref)(\s+(.+))?/i)
          if (m) {
            const link = (m[3] || '').trim()
            if (link) {
              if (parent) {
                if (!parent.mdLinks) parent.mdLinks = []
                if (!parent.mdLinks.find(e => e === link)) {
                  parent.mdLinks.push(link)
                }
              }
            }
            this.ignore = true
          } else {
            m = this.name.match(/^(if|else|loop|parallel|box|group)(\s+(.+))?/i)
            if (m) {
              this.cmd = (m[1] || '').trim().toUpperCase()
              this.name = (m[3] || '').trim()
            }
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

  getUpperName(name: string) {
    return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  }

  init(isRoot: boolean) {
    if (!isRoot) this.id = undefined
    if (this.umlType === 'sequence') {
      if (isRoot) {
        if (this.key) {
          const { GROUP } = require('./SeqTag')
          const gr = new GROUP(this.name, this.startC, this.umlType)
          gr.docSequence = this.docSequence
          gr.mdLinks = this.mdLinks
          gr.init(isRoot)
          Comment.Comments.set(this.key, gr)
        } else {
          this.title = this.name
          this.outputName = Testcase.toFileName(this.name)
          if (!this.ctx) {
            // this.ctx = 'App'
            this.ctx = this.docSequence.appName
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

  replaceThisAndTarget(str: string) {
    str = str.replace(/\{\}/g, `{{${this.ctx || 'IMPOSSIBLE_ERROR'}}}`)
    // if (this.client) {
    str = str.replace(/\{\s*client\s*\}/gi, `{{{${this.client || 'Client'}}}}`)
    // }
    return str
  }

  mmdSequence(txt: string) {
    const uctx = this.getUpperName(this.ctx)
    if (/^note [^:]+:(.+)/i.test(txt)) {
      let m = txt.match(/^\s*note\s((right of)|(left of)|(over))\s+([^,\:]+)\s*(,\s*(.*?))?(\:.+)/i)
      if (m) {
        if (m[2] || m[3]) {
          m[5] = Actor.getActor(this.replaceThisAndTarget(m[5])).uname
          this.root.participants.add(m[5])
        } else if (m[4] && m[7]) {
          m[5] = Actor.getActor(this.replaceThisAndTarget(m[5])).uname
          m[7] = Actor.getActor(this.replaceThisAndTarget(m[7])).uname
          this.root.participants.add(m[5], m[7])
        }
      }
      txt = `NOTE ${m[1].toUpperCase()} ${m[5]}${m[7] ? `, ${m[7]}` : ''}${m[8]}`
    } else {
      let m = txt.match(/\s*(.*?)\s*(->|<-|=>|<=|x>|<x|>|<)\s*(.*?):(.*)/i)
      if (m) {
        const [main, ...des] = txt.split(':')
        txt = this.replaceThisAndTarget(main) + ':' + des.join('')
        m = txt.match(/\s*(.*?)\s*(->|<-|=>|<=|x>|<x|>|<)\s*(.*?):(.*)/i)

        m[1] = m[1]?.trim()
        m[2] = m[2]?.trim()
        m[3] = m[3]?.trim()
        m[4] = m[4]?.trim()

        // Parser actor
        let action = m[2].trim()
        const { label, dir, seqDir } = Actor.getActionName(action, m[4], this.docSequence.showEventDetails, this.docSequence.showRequestDetails)
        if (dir > 0) {
          this.docSequence._flowChart.addActor(m[1].trim(), m[3].trim(), action, des.join(''))
        } else {
          this.docSequence._flowChart.addActor(m[3].trim(), m[1].trim(), action, des.join(''))
        }
        const actor1 = Actor.getActor(dir > 0 ? m[1].trim() : m[3].trim())
        const actor2 = Actor.getActor(dir < 0 ? m[1].trim() : m[3].trim())
        if (actor1.name !== actor2.name && actor1.name && actor2.name) {
          actor1.name.split('/').map(e => e.trim()).forEach(name1 => {
            name1 = name1.trim()
            const actor1 = Actor.getActor(name1)
            actor2.name.split('/').map(e => e.trim()).forEach(name2 => {
              name2 = name2.trim()
              if (!actor1.actions[name2]) {
                actor1.actions[name2] = new Set()
              }
              if (label) {
                actor1.actions[name2].add(label)
              }
            })
          })
        }
        this.root.participants.add(actor1.uname, actor2.uname)

        m[1] = dir > 0 ? `${actor1.uname}` : `${actor2.uname}`
        m[3] = dir < 0 ? `${actor1.uname}` : `${actor2.uname}`
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
          const mthrow = m[4].match(/^\s*throws? ([^\-]+)-(.*)/i)
          if (mthrow) {
            let [code = '', status = ''] = (mthrow[1] || '').split('/')
            status = status.trim()
            code = code.trim()
            if (!status) {
              status = code
              code = undefined
            }
            const message = (mthrow[2] || '').trim()
            if (!this.root.errors[status]) {
              this.root.errors[status] = {
                details: {}
              }
            }
            if (code) {
              if (!this.root.errors[status].details[code]) {
                this.root.errors[status].details[code] = []
              }
              this.root.errors[status].details[code].push({ code, message })
            } else {
              this.root.errors[status].message = message
            }
          }
        }
      } else {
        txt = `${uctx} ->> ${uctx}: ${txt}`
      }
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

  prePrint(msg: ArrayUnique, _i: number, _tab: string, mtab: string): string {
    if (!this.name) {
      if (this.key) {
        msg.push(`${mtab}%% ${this.key}`)
      } else {
        msg.push(`${mtab}%% ${this.cmd || 'COMMENT'}`)
      }
    }
    if (this.name && this.childs.length) {
      return `OPT ${this.name}`
    }
    return ''
  }

  postPrint(_msg, _i: number, _tab: string, _mtab: string): string {
    if (this.name && this.childs.length) {
      return `END`
    }
    return ''
  }

  getPrint(_msg, _i: number, _tab: string, _mtab: string): string {
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
        newOne._ctx = child._ctx
        newOne.umlType = this.umlType
        newOne.startC = child.startC
        this.root.mdLinks.push(...child.mdLinks.concat(newOne.mdLinks))
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

  printChild(msg: ArrayUnique, _i: number, tab = '|-', _mtab: string) {
    this.childs.forEach((child: Comment, i: number) => {
      child.print(msg, i, tab.replace(/-/g, ' ') + '|-')
    })
  }

  printTagName() {
    if (this.key) {
      return `${chalk.magenta(this.name)}${this.name ? ' ' : ''}${chalk.italic.gray(`[${this.key}]`)}`
    }
    return this.childs.length ? chalk.magenta(this.name) : ''
  }

  print(msg: ArrayUnique, _i: number, tab = '|-') {
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
    const txt = this.getPrint(msg, _i, tab, mtab)
    if (txt && !this.key && !this.docSequence.slient) context.log(chalk.gray(tab) + color(raw))

    const preText = this.prePrint(msg, _i, tab, mtab)
    if (preText) msg.push(mtab + preText)

    if (txt) msg.push(mtab + txt)

    this.printChild(msg, _i, tab, mtab)

    const postText = this.postPrint(msg, _i, tab, mtab)
    if (postText) msg.push(mtab + postText)
  }

  printClass(writer, _i: number, tab = '  ') {
    this.prepare()
    const mtab = tab.replace(/\W/g, ' ')
    const { EMPTY } = require('./SeqTag')
    if (!(this instanceof EMPTY)) {
      if (!this.type) {
        if (!this.docSequence.slient) context.log(chalk.yellow(`${tab}class ${chalk.bold(this.key)}`))
        writer.write(`${mtab}class ${this.key} {\r\n`)
        this.name?.split(':')
          .map(e => e.trim())
          .filter(e => e)
          .reverse()
          .forEach(key => {
            writer.write(`<<${key}>>\r\n`)
          })
        if (this.extends) {
          this.relations.push(`${this.key} --> ${this.extends}: Inheritance`)
        }
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
              this.parent.relations.push(`${this.parent.key} ${relation} ${clazz}: ${isRefType ? `${this.key}` : `${this.parent.relations.length + 1}`}`)
            } else {
              if (!relation) relation = `"${this.key}" --|> "${prop}"`
              this.parent.relations.push(`${this.parent.key} ${relation} ${clazz}: ${isRefType ? `${this.key}` : `${this.parent.relations.length + 1}`}`)
            }
          }
        }
        let preKey = ''
        let parent = this.parent
        while (parent && parent.type) {
          preKey = ' ..' + ' ' + preKey
          parent = parent.parent
        }
        writer.write(`${mtab}+${preKey}${this.key} ~${this.type}~${this.name ? (' : ' + this.name.replace(/\W/g, '_')) : ''}\r\n`)
      }
    }
    this.childs.forEach((child, i) => {
      child.printClass(writer, i, tab + '  ')
    })
    if (!(this instanceof EMPTY) && !this.type) {
      writer.write(`${mtab}}\r\n`)
      writer.write(`${this.relations.join('\r\n')}\r\n`)
    }
  }
}
import chalk from "chalk"
import { Comment } from "./Comment"

export class GROUP extends Comment {
  override prePrint() {
    if (!this.name) return ''
    return `OPT ${this.name}`
  }

  override postPrint(_writer, _i: number, _tab: string, _mtab: string) {
    if (!this.name) return ''
    const idx = this.parent.childs.findIndex(child => child === this)
    if (this.parent.childs[idx + 1] instanceof ELSE) {
      return ''
    }
    return 'END'
  }

  override printTagName() {
    if (!this.name) return `${chalk.blue('GROUP')}`
    return `${chalk.blue('OPT')} ${this.name}`
  }
}

export class EMPTY extends Comment {

}

export class PARALLEL extends Comment {

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

export class LOOP extends Comment {

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

export class BOX extends Comment {

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

export class IF extends Comment {

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

export class ELSE extends IF {

  override prePrint() {
    return `ELSE ${this.name}`
  }

  override printTagName() {
    return `${chalk.blue('ELSE')} ${this.name}`
  }

}

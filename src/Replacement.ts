class Eval {
  constructor(public str: string) { }

  getValue(context = {} as any) {
    const declare = Object.keys(context).map(k => `const ${k} = context.${k}`).join('\n')
    let rs17263817
    const script = `${declare}
      rs17263817 = ${this.str}
    `
    try {
      eval(script)
      return rs17263817
    } catch (err) {
      console.error(script)
      throw err
    }
  }
}

export class Replacement {
  private static splitText(a = '' as string) {
    let c = null
    let tmp = []
    const rs = []
    a.split('').forEach((s) => {
      if (s === '$' && !c) {
        if (tmp.length > 0) {
          rs.push(tmp.join(''))
          tmp = []
        }
        c = []
      } else if (c !== null && s === '{') {
        if (c.length > 0) {
          tmp.push(s)
        }
        c.push(' ')
      } else if (c !== null && s === '}') {
        c.pop()
        if (c.length > 0) {
          tmp.push(s)
        }
        if (c.length === 0) {
          rs.push(new Eval(tmp.join('')))
          tmp = []
          c = null
        }
      } else {
        tmp.push(s)
      }
    })
    if (tmp.length > 0) {
      rs.push(tmp.join(''))
      tmp = []
      c = null
    }
    return rs
  }

  static getValue(a: string, context = {} as any) {
    const rs = this.splitText(a)
    const vl = rs.map(s => {
      return s instanceof Eval ? s.getValue(context) : s
    })
    return vl.length > 1 ? vl.join('') : vl[0]
  }
}
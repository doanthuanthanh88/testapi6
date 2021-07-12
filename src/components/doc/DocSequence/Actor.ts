export class Actor {
  static slient: boolean
  static actors = {} as Actor[]
  static declare = new Map<string, string>()
  actions = {} as { [actor: string]: Set<string> }
  sign: '+' | '-' | ''
  uname: string

  constructor(public name: string) {
    this.uname = this.getUpperName(name)
  }

  getUpperName(name: string) {
    return name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  }

  static getActionName(action: string, des: string, showEventDetails: boolean, showRequestDetails: boolean) {
    switch (action) {
      case '=>':
      case 'x>':
        return showRequestDetails ? {
          type: 'request',
          seqDir: 1,
          dir: 1,
          label: '-->|' + des.replace(/"/g, "'") + '|'
        } : {
          type: 'request',
          seqDir: 1,
          dir: 1,
          label: '-->|req|'
        }
      case '<x':
      case '<=':
        return {
          seqDir: -1,
          dir: -1,
          label: ''
        }
      case '->':
        return showEventDetails ? {
          type: 'event',
          seqDir: 1,
          dir: 1,
          label: '-.->|' + des.replace(/"/g, "'") + '|'
        } : {
          seqDir: 1,
          dir: 1,
          label: '-.->|pub|'
        }
      case '<-':
        return showEventDetails ? {
          type: 'event',
          seqDir: -1,
          dir: -1,
          label: '-.->|' + des.replace(/"/g, "'") + '|'
        } : {
          seqDir: -1,
          dir: -1,
          label: '-.->|sub|'
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

  static getActor(name: string) {
    const m = name.match(/\s*([\(\[<\{})]{1,5})?([^\(\[<\)\]\{\}>)]+)([\)\]\}>)]{1,5})?/)
    let sign = ''
    if (m) {
      name = m[2]
      const m1 = m[2].match(/^([\+\-])?(.+)/)
      name = m1[2].trim()
      sign = (m1[1] || '')
    }
    let actor: Actor = Actor.actors[name]
    if (!actor) {
      actor = Actor.actors[name] = new Actor(name)
    }
    actor.sign = sign as any
    name.split('/').map(e => e.trim()).forEach(name => {
      if (!Actor.actors[name]) {
        Actor.actors[name] = new Actor(name)
        Actor.actors[name].sign = sign
      }
    })
    return actor
  }
}
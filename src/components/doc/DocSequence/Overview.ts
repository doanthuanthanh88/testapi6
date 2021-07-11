import { context } from "@/Context"
import chalk from "chalk"

export class Actor {
  static slient: boolean
  static actors = {} as Actor[]
  static declare = new Map<string, string>()
  actions = {} as { [actor: string]: Set<string> }
  sign: '+' | '-' | ''

  constructor(public name: string) { }

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

  static getActor(name: string, onlyGet = false) {
    const m = name.match(/\s*([\(\[<\{})]{1,5})?([^\(\[<\)\]\{\}>)]+)([\)\]\}>)]{1,5})?/)
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
          if (m[1] === '{{' && m[3] === '}}') {
            // Context {}
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}`, 'App'))
          } else if (m[1] === '{{{' && m[3] === '}}}') {
            // Client Context {Client}
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}`, 'Client'))
          } else if (m[1] === '{' && m[3] === '}') {
            // Service {ServiceName}
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}`, 'Other Services'))
          } else if (m[1] === '[' && m[3] === ']') {
            // Database [MySQL]
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}[(${m[2]})]`, ''))
          } else if (m[1] === '(' && m[3] === ')') {
            // Other (Redis) (RabbitMQ)
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}((${m[2]}))`, ''))
          } else {
            name.split('/').forEach(name => Actor.declare.set(`${name.trim()}${m[1]}${name.trim()}${m[3]}`, ''))
          }
        }
      }
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
              actor1 = actor1.trim()
              actor2.split('/').forEach(actor2 => {
                actor2 = actor2.trim()
                writer.write(`${actor1} ${action} ${actor2}\r\n`)
              })
            })
            if (!Actor.slient) context.log(`${chalk.gray('-')} ${chalk.magenta(actor1)} ${chalk.blue(action)} ${chalk.magenta(actor2)}`)
          }
        }
      }
    }
  }

  static saveShort(writer: any, serviceName: string) {
    let cached = new Set()
    for (const name in Actor.actors) {
      const actor = Actor.actors[name]
      for (const a in actor.actions) {
        for (const action of actor.actions[a]) {
          // const { label, dir } = Actor.getActioinName(action)
          if (name) {
            let actor1 = name // dir > 0 ? name : a
            let actor2 = a // dir < 0 ? name : a
            actor1.split('/').forEach(actor1 => {
              actor1 = actor1.trim()
              const serviceType = Actor.declare.get(actor1)
              if (serviceType) {
                if (serviceType === 'App') {
                  actor1 = serviceName
                } else if (serviceType !== 'Other Services') {
                  actor1 = serviceType
                }
              }
              actor2.split('/').forEach(actor2 => {
                actor2 = actor2.trim()
                const serviceType = Actor.declare.get(actor2)
                if (serviceType) {
                  if (serviceType === 'App') {
                    actor2 = serviceName
                  } else if (serviceType !== 'Other Services') {
                    actor2 = serviceType
                  }
                }
                const txt = `${actor1} ${action.replace(/\|.*?\|/g, '')} ${actor2}\r\n`
                if (!cached.has(txt)) {
                  cached.add(txt)
                  writer.write(txt)
                }
              })
            })
            if (!Actor.slient) context.log(`${chalk.gray('-')} ${chalk.magenta(actor1)} ${chalk.blue(action)} ${chalk.magenta(actor2)}`)
          }
        }
      }
    }
  }
}
import { Type } from 'js-yaml'

export const remove = new Type('!remove', {
  kind: 'scalar',
  construct: () => {
    return null
  }
})

export const keep = new Type('!keep', {
  kind: 'scalar',
  construct: () => {
    return undefined
  }
})

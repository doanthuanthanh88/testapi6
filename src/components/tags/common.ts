import { Type } from 'js-yaml'
import { ERASE } from '../Tag'

export const erase = new Type('!erase', {
  kind: 'scalar',
  construct: () => {
    return ERASE
  }
})

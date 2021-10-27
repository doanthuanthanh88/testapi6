import { context } from '@/Context';
import { Type } from 'js-yaml';

export const jwt = new Type('!jwt', {
  kind: 'scalar',
  instanceOf: Object,
  construct: (token) => {
    return context.Utils.jwt(token)
  }
})
import { Type } from 'js-yaml'

export const api = new Type('!api', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Api: data
    }
  }
})

export const apiGet = new Type('!get', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Get: data
    }
  }
})

export const apiPost = new Type('!post', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Post: data
    }
  }
})

export const apiPut = new Type('!put', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Put: data
    }
  }
})

export const apiPatch = new Type('!patch', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Patch: data
    }
  }
})

export const apiHead = new Type('!head', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Head: data
    }
  }
})

export const apiDelete = new Type('!delete', {
  kind: 'mapping',
  instanceOf: Object,
  construct: (data) => {
    return {
      Delete: data
    }
  }
})
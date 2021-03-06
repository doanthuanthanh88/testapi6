import { createReadStream, ReadStream } from 'fs'
import { Type } from 'js-yaml'
import { Testcase } from '../Testcase'

export const upload = new Type('!upload', {
  kind: 'scalar',
  instanceOf: ReadStream,
  construct: (data) => {
    const file = Testcase.getPathFromRoot(data)
    return createReadStream(file)
  }
})

import { Type } from 'js-yaml'
import { createReadStream, } from 'fs'
import { Testcase } from '../Testcase'
import { ReadStream } from 'tty'

export const upload = new Type('!upload', {
  kind: 'scalar',
  instanceOf: ReadStream,
  construct: (data) => {
    const file = Testcase.getPathFromRoot(data)
    return createReadStream(file)
  }
})

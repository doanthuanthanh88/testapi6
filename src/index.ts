const Module = require('module');
const ROOT = __dirname + '/'

const _require = Module.prototype.require
Module.prototype.require = function reallyNeedRequire(name) {
  if (name?.startsWith('testapi6/')) {
    return _require.call(this, name.replace('testapi6/dist/', ROOT))
  }
  return _require.call(this, name)
}

import { InputYamlFile, main } from '@/main'

main(new InputYamlFile(process.argv[2]), process.argv[3])

// (async () => {
//   await main(new InputYamlText('- !echo thanh', process.argv[2]))
//   console.log('here', context.tc)
// })()

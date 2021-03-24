const { compilerOptions } = require('../tsconfig.json')
const path = require('path')

const map = {}
for (let k in compilerOptions.paths) {
  map[k.replace('/*', '/')] = path.resolve(path.join(compilerOptions.baseUrl, compilerOptions.paths[k][0].replace('/*', '/')))
}
const mapKeys = Object.keys(map)

module.constructor.prototype.require = function (basePath) {
  let sourcePath
  if ((sourcePath = mapKeys.find(e => basePath.startsWith(e)))) {
    let targetPath = map[sourcePath]
    targetPath = path.relative(path.dirname(this.filename), targetPath)
    if (!targetPath.startsWith('/')) targetPath = './' + targetPath
    filepath = basePath.replace(sourcePath, targetPath + '/')
  } else {
    filepath = basePath
  }
  return this.constructor._load(filepath, this);
}
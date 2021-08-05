const { readdirSync, statSync, writeFileSync } = require('fs')
const { join } = require('path')

function getFiles(folder, rs) {
  const files = readdirSync(folder)
  files.forEach(f => {
    const fname = f
    const ff = join(folder, f)
    const stats = statSync(ff)
    if (stats.isFile()) {
      rs.push({ name: fname })
    } else {
      const arr = []
      rs.push({
        name: fname,
        childs: arr
      })
      getFiles(ff, arr)
    }
  })
  return rs
}

const files = { examples: [], guide: [] }
getFiles(join(__dirname, '../test/examples'), files.examples)
getFiles(join(__dirname, '../guide'), files.guide)

writeFileSync(join(__dirname, '../test/examples.json'), JSON.stringify(files))

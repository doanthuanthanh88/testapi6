import './init'
import { InputYamlFile, main } from '@/main'
import { program } from 'commander'
import { existsSync } from 'fs'
import { join } from 'path'

// setTimeout(async () => {
//   main(new InputYamlFile(process.argv[2]), process.argv[3], process.argv[4])
// }, 500)

const packageJson = [join(__dirname, '../package.json'), join(__dirname, './package.json')].find(src => existsSync(src))
const { version, description, name, repository } = require(packageJson)

const cmd = program
  .name(name)
  .version(version, '', description)
  .argument('<file>', 'Scenario path or file', undefined, 'index.yaml')
  .argument('[password]', 'Password to decrypt scenario file')
  .option('-e, --env <csv|json>', `Environment variables.    
                        + csv: key1=value1;key2=value2
                        + json: {"key1": "value1", "key2": "value2"}`)
  .addHelpText('after', `More:\n  ${repository.url}`)
  .parse(process.argv)

const [yamlFile, password] = cmd.args
let { env } = cmd.opts()

if (env && typeof env === 'string') {
  try {
    env = JSON.parse(env)
  } catch {
    env = env.trim().split(';').reduce((sum, e) => {
      e = e.trim()
      if (e) {
        const idx = e.indexOf('=')
        if (idx !== -1) sum[e.substr(0, idx)] = e.substr(idx + 1)
      }
      return sum
    }, {})
  }
}

main(new InputYamlFile(yamlFile), password, env)
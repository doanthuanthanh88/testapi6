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
  .option('-e, --env <json_env>', 'Environment variable')
  .addHelpText('after', `More:\n  ${repository.url}`)
  .parse(process.argv)

const [yamlFile, password] = cmd.args
const { env = '{}' } = cmd.opts()

main(new InputYamlFile(yamlFile), password, eval(env))
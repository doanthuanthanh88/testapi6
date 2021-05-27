import { Api } from '@/components/api/Api'
import { Group } from '@/components/Group'
import { replaceVars } from '@/components/Tag'
import { loadConfig } from '@/config'
import chalk from 'chalk'
import { merge, omit, pick } from 'lodash'
import { join, resolve } from 'path'
import { context } from '../Context'

context
  .on('log:testcase:begin', (e: Testcase) => {
    if (e.title) context.group(e.title, `(${e.version})`, ':', e.description)
  })
  .on('log:testcase:end', (e: Testcase) => {
    context.log()
    if (e.title) context.groupEnd()
    context.log()
    if (!e.error) {
      context.group(chalk.bgCyan.bold('Summary'), '-', chalk.gray(`${e.result.time}ms`))
      context.log('- %s: %d', chalk.green('Passed'), e.result.passed)
      context.log('- %s: %d', chalk.red('Failed'), e.result.failed)
      context.log('- %s: %d', 'Totals', e.result.totals)
      context.groupEnd()
    } else {
      context.group(chalk.red('- %s: %s'), 'Error', e.error.message)
      context.log(e.error)
      context.groupEnd()
    }
  })

/**
 * Testcase which includes meta data to help to generate doc
 */
export class Testcase {
  static APIs = [] as Api[]
  static RootDir: string

  static getPathFromRoot(str: string) {
    return str.startsWith('/') ? resolve(str) : join(Testcase.RootDir, str)
  }

  static async Stop() {
    context.log(chalk.red('>>> Force stop <<<'))
    context.emit('app:stop')
  }

  /** Result after run all of test */
  result = {
    /** APIs passed */
    passed: 0,
    /** APIs failed */
    failed: 0,
    /** Execution time */
    time: 0,
    /** Total APIs */
    get totals() {
      return this.passed + this.failed
    }
  }

  /** Document title */
  title: string
  /** Document version */
  version: string
  /** Servers test which for each of environments 
   * 
   * Examples:
   * servers:
   *   dev: http://localhost
   *   prod: http://prod.com
  */
  servers: { [name: string]: string }
  /** Developer */
  developer?: string
  /** Set debug for this testcase */
  debug: boolean
  /** Document description */
  description: string
  /** Output style */
  style: 'test' | 'doc' | 'summary'
  /** Global variables which can be overided by ENV variables */
  vars: object
  /** Keep playing when got somethings error */
  ignoreError: boolean
  isTestSome: boolean
  group: Group
  error: any
  state = 'init' as 'init' | 'prepare' | 'run' | 'stoped'

  /** Secret key
   * 
   * Encrypt scenarios to file .yaml.encrypt which help to uploading scenario to unsecure server then load them then decrypt
   */
  encryptPassword?: string
  decryptPassword?: string

  constructor(root: any) {
    const t = pick(root, ['title', 'version', 'servers', 'developer', 'debug', 'description', 'vars', 'group', 'encryptPassword'])
    const g = omit(root, ['title', 'version', 'servers', 'developer', 'debug', 'description', 'vars', 'group', 'encryptPassword'])
    merge(this, { title: '', version: '', description: '', servers: {}, endpoints: {} }, t)
    merge(context.Vars, replaceVars(root.vars))
    this.group = new Group(g)
    this.group.tagName = 'Root'
    this.group.tc = this
    if (root.script) eval(root.script)

    let isForceStop
    process.on('SIGINT', async () => {
      if (!isForceStop) {
        isForceStop = true
        await Testcase.Stop()
      } else {
        process.exit()
      }
    });
  }

  async setup() {
    context.Vars = loadConfig(context.Vars, Testcase.getPathFromRoot('.env'))
    this.state = 'init'
    await this.group.setup(this)
  }

  async exec() {
    await this.setup()
    try {
      context.emit('log:testcase:begin', this)
      const begin = Date.now()
      this.state = 'prepare'
      await this.group.prepare()
      this.state = 'run'
      await this.group.exec()
      this.result.time = Date.now() - begin
    } catch (err) {
      this.error = err
    } finally {
      this.state = 'stoped'
      context.emit('log:testcase:end', this)
    }
    context.emit('finished', this.result.failed > 0, this)
  }
}
import { context } from "@/Context";
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { Tag } from "../Tag";

/**
 * Execute external command line
 * 
 * ```yaml
 * - Exec:
 *     title: Push notification when test something wrong
 *     args:
 *       - echo
 *       - Run failed
 * ```
 */
export class Exec extends Tag {
  /** Arguments */
  args: string[]
  /** Set data after this executed done */
  var: string | { [key: string]: any }
  /** Exit code */
  code: number
  /** Log content */
  log: string[]
  prc: ChildProcessWithoutNullStreams

  init(attrs) {
    super.init(attrs)
    if (this.var) this.log = []
  }

  stop() {
    return this.prc?.kill()
  }

  exec() {
    const [cmd, ...args] = this.args
    if (this.title !== null) {
      context.log(this.title || `> ${cmd} ${args.map(e => `"${e}"`).join(" ")}`)
    }
    this.prc = spawn(cmd, args)

    // Listen to force stop
    context.once('app:stop', async () => {
      await this.stop()
    })

    return new Promise((resolve) => {
      this.prc.on('message', msg => this.onMessage(msg))
      this.prc.on('error', err => this.onError(err))
      this.prc.stdout.on('data', msg => this.onMessage(msg))
      this.prc.stderr.on('data', err => this.onError(err))
      this.prc.on('close', code => {
        this.onDone(code)
        resolve(code)
      })
    })
  }

  onMessage(msg: any) {
    this.log?.push(msg.toString())
    if (!this.slient) context.log(msg.toString())
  }

  onError(msg: any) {
    if (!this.error) this.error = ''
    this.error += msg + '\n'
    this.log?.push(msg.toString())
    if (!this.slient) context.log(msg.toString())
  }

  onDone(code: any) {
    this.code = code
    if (this.code !== 0) this.error = `Error code ${this.code}`
    if (this.var) this.setVar(this.var, this.code)
    this.prc = null
  }
}
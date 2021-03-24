import { context } from '@/Context'
import * as readline from 'readline'
import { Tag } from './Tag'

/**
 * Wait for specific time or pause the process
 * 
 * ```yaml
 * - Pause: # Wait user enter then keep doing
 * 
 * - Pause:
 *     title: Sleep 1s
 *     time: 1000
 * ```
 */
export class Pause extends Tag {
  /** Time to wait (ms) */
  time: number

  _rl: any
  _tm: any

  constructor(attrs: number | Pause) {
    super(attrs, 'time')
  }

  async prepare() {
    await super.prepare()
    this.time = this.replaceVars(this.time)
    this.time = +this.time
  }

  stop() {
    return Promise.all([
      this._tm && clearTimeout(this._tm),
      this._rl?.close(),
    ])
  }

  pause() {
    context.log(`${this.title || '...'} (continue?)`)
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    return new Promise((r) => {
      this._rl.question('', () => {
        this._rl.close()
        r(undefined)
      })
    })
  }

  delay() {
    context.log(`|| Sleep ${this.time}ms (${this.title || ''})`)
    return new Promise((r) => {
      this._tm = setTimeout(r, this.time)
    })
  }

  async exec() {
    // Listen to force stop
    context.once('app:stop', async () => {
      await this.stop()
    })
    if (this.time) {
      await this.delay()
    } else {
      await this.pause()
    }
  }

}
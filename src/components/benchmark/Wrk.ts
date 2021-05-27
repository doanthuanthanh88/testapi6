import { existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { stringify } from "querystring";
import { context } from "../../Context";
import { Api } from "../api/Api";
import { Exec } from "../external/Exec";
import { Testcase } from "../Testcase";

/**
 * Execute wrk command line to test benchmark
 */
export type IWrk = {
  /** Num of connection */
  connections: number
  /** Duration test */
  duration: string
  /** Num of threads */
  threads: number
  /** Latency */
  latency: boolean
  /** Version */
  version: boolean
  /** Customize script which is imported in wrk */
  script: string
  /** Request timeout */
  timeout: string
  /** Request body data */
  bodyData: string
  /** Save result to */
  saveTo?: string
  /** Metadata info which include in result */
  info?: any
}

export class Wrk extends Exec {
  connections: number
  duration: string
  threads: number
  latency: boolean
  version: boolean
  script: string
  timeout: string
  bodyData: string
  saveTo?: string
  info?: any
  // @ts-ignore
  $$: Api

  constructor(attrs: IWrk) {
    super(attrs)
    this.args = ['wrk']
  }

  async prepare() {
    await super.prepare()
    if (this.connections) this.args.push(`--connections=${this.connections}`)
    if (this.duration) this.args.push(`--duration=${this.duration}`)
    if (this.threads) this.args.push(`--threads=${this.threads}`)
    if (this.timeout) this.args.push(`--timeout=${this.timeout}`)
    if (this.latency) this.args.push(`--latency`)
    if (this.version) this.args.push(`--version`)
    if (this.$$) {
      if (!this.title) {
        if (this.$$.title) {
          this.title = `> Benchmark: ${this.$$.title}`
        }
      }
      if (this.$$.headers) {
        Object.keys(this.$$.headers).forEach(k => {
          this.args.push('--header')
          this.args.push(`${k}: ${this.$$.headers[k]}`)
        })
      }
      if (this.script) {
        this.args.push('--script')
        let scriptFile = Testcase.getPathFromRoot(this.script)
        if (!existsSync(scriptFile)) {
          scriptFile = join(tmpdir(), `wrk.${Date.now()}.lua`)
          writeFileSync(scriptFile, `
          function jsonParser(sdata)
            json = require "json"
            return json.decode(sdata)
          end
          function jsonStringify(obj)
            json = require "json"
            return json.encode(obj)
          end
          function readAll(file)
            local f = assert(io.open(file, "rb"))
            local content = f:read("*all")
            f:close()
            return content
          end
          function readLine(file)
            lines = {}
            for line in io.lines(file) do 
              lines[#lines + 1] = line
            end
            return lines
          end
${this.script}`)
        }
        this.args.push(`${scriptFile}`)
      } else if (this.$$.method != 'GET') {
        // Create tmp.lua
        const cnt = [`wrk.method = "${this.$$.method}"`]
        if (this.bodyData) {
          cnt.push(`wrk.body = "${stringify(this.$$.body)}"`)
        }
        cnt.push('')

        if (!this.script) {
          this.script = join(tmpdir(), `.tmp.wrk.${context.Utils.random()}.lua`)
          writeFileSync(this.script, cnt.join('\n'))
        }

        this.args.push('-s')
        this.args.push(`${this.script}`)
      }
      this.args.push(this.$$.baseURL)
    }
    if (this.saveTo) {
      this.saveTo = Testcase.getPathFromRoot(this.saveTo)
      this.log = []
    }
  }

  async exec() {
    try {
      await super.exec()
      await this.save()
    } finally {
      if (this.script?.startsWith('.tmp.wrk.')) unlinkSync(this.script)
    }
  }

  /**
   * Generate document
   */
  async save() {
    let content = []
    content.push(`# ${this.$$.title || this.tc.title}`)
    content.push(`_${this.$$.description || this.tc.description}_`)
    content.push('')
    content.push('')
    if (this.tc?.version) content.push(`> Version ${this.tc.version}`)
    if (this.tc?.developer) {
      content.push('')
      content.push(`> Developed by [**${this.tc.developer.split('@')[0]}**](mailto:${this.tc.developer})`)
      content.push('')
    }
    content.push('## Benchmark')
    content.push(`| Information | ${this.$$.baseURL || ''}${this.$$.url} |`)
    content.push('| --- | ---- |')
    content = content.concat(Object.keys(this.info || {}).map(k => `| - ${k} | \`${this.info[k]}\` |`))
    content.push('| **Testing paramters** | |')
    content.push(`| - connections | \`${this.connections}\` |`)
    content.push(`| - duration | \`${this.duration}\` |`)
    content.push(`| - threads | \`${this.threads}\` |`)
    content.push(`| - timeout | \`${this.timeout}\` |`)
    content.push('')

    content.push('## Result')
    content.push('```sh')
    content = content.concat(this.log)
    content.push('```')

    if (this.saveTo) {
      writeFileSync(this.saveTo, content.join('\n'))
    }
  }

}
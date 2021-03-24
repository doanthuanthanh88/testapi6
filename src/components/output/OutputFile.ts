import chalk from 'chalk'
import { Tag } from "../Tag";
import { writeFileSync } from 'fs';
import { Testcase } from '../Testcase';
import { context } from '@/Context';

/**
 * Save to file
 * 
 * ```yaml
 * - Vars:
 *     name: test
 * 
 * - OutputFile:
 *     title: Save content to file
 *     content: Hello world ${name}
 *     saveTo: examples/assets/hello.txt
 * ```
 */
export class OutputFile extends Tag {
  /** String data content */
  content: string
  /** Output file to save */
  saveTo: string

  constructor(attrs) {
    super(attrs)
  }

  async prepare() {
    await super.prepare()
    this.saveTo = Testcase.getPathFromRoot(this.saveTo)
  }

  async exec() {
    await this.save()
  }

  async save() {
    if (!this.title) this.title = 'A file'
    writeFileSync(this.saveTo, this.content && typeof this.content === 'object' ? JSON.stringify(this.content) : `${this.content}`)
    context.log(chalk.magentaBright('- %s was saved at "%s"'), this.title, this.saveTo)
  }
}

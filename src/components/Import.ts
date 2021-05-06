import { Tag } from "./Tag";
import { safeLoad } from 'js-yaml'
import { readFileSync, writeFileSync } from 'fs'
import { Testcase } from "./Testcase";
import { context } from "../Context";
import { SCHEMA } from ".";
import { handleHttpFile } from '../main'
import { extname } from "path";
import chalk from "chalk";

export function loadContent(file, encryptPassword: string, decryptPassword: string) {
  if (decryptPassword) {
    if (!file.endsWith('.encrypt')) {
      file += '.encrypt'
    }
  }
  let cnt = readFileSync(file, 'utf8').toString()
  if (decryptPassword) {
    cnt = context.Utils.crypto.decryptAES(cnt, decryptPassword)
  }
  const type = extname(file)
  const msg = []
  let root: any
  try {
    if (type && type !== '.yaml' && type !== '.yml' && type !== '.encrypt') throw 'next'
    root = safeLoad(cnt, { schema: SCHEMA })
    return root
  } catch (err) {
    msg.push('yaml:' + err?.message)
    try {
      if (type && type !== '.json') throw 'next'
      root = JSON.parse(cnt)
      return root
    } catch (err) {
      if (type && type !== '.csv') throw new Error(`Not support ${type}`)
      msg.push('json:' + err?.message)
      try {
        root = cnt.split('\n').map(e => e.split(','))
        return root
      } catch (err) {
        msg.push('csv:' + err?.message)
        throw new Error(msg.join('\n'))
      }
    }
  } finally {
    if ('\0\0\0' === encryptPassword) {
      encryptPassword = root.encryptPassword
    }
    if (encryptPassword) {
      // Generate encrypt file
      writeFileSync(file + (!file.endsWith('.encrypt') ? '.encrypt' : ''), context.Utils.crypto.encryptAES(cnt.replace(/^(password\s*\:.+)$/m, `# Decrypted!`), encryptPassword.toString()))
    }
  }
}

/**
 * Import a file .yaml in the current script
 * 
 * ```yaml
 * - Import: ./exam_01.yaml
 * - Import: 
 *     src: ./exam_02.yaml
 * ```
 */
export class Import extends Tag {
  /** Absolute or relative path of file */
  src: string

  constructor(attrs: string | Tag) {
    super(attrs, 'src')
  }

  async exec() { }

  async setup(tc: Testcase) {
    this.tc = tc
    if (this.src?.startsWith('http://') || this.src?.startsWith('https://')) {
      this.src = await handleHttpFile(this.src)
    }
    const root = loadContent(Testcase.getPathFromRoot(this.src), tc.encryptPassword, tc.decryptPassword)
    if (this.title && Array.isArray(root)) {
      return [{
        Group: {
          title: chalk.gray.underline(this.title.toUpperCase()),
          icon: chalk.gray('⬇ '),
          steps: root
        }
      }]
    }
    return root
  }
}
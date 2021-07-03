import { existsSync, lstatSync } from 'fs';
import { merge } from "lodash";
import { basename, dirname, join, resolve } from 'path';
import { context } from "./Context";
import { SCHEMA } from './components'
import { includeComment, loadContent } from './components/Import'
import { Testcase } from './components/Testcase'

export class InputYamlFile {
  constructor(public yamlFile: string) { }
}
export class InputYamlText {
  constructor(public yamlText: string, public yamlFile: string) { }
}

export async function handleHttpFile(yamlFile: string, decryptPassword?: string) {
  if (yamlFile?.startsWith('http://') || yamlFile?.startsWith('https://')) {
    const axios = require('axios')
    const response = await axios.get(yamlFile, { responseType: 'stream' });
    const { tmpdir } = require('os')
    yamlFile = join(tmpdir(), `${context.Utils.random()}.yaml` + (decryptPassword ? '.encrypt' : ''))
    const { createWriteStream } = require('fs')
    const writer = createWriteStream(yamlFile)
    response.data.pipe(writer)
    return new Promise<string>((resolve, reject) => {
      writer.on('finish', () => resolve(yamlFile))
      writer.on('error', reject)
    })
  }
  return resolve(yamlFile)
}

export async function load(inp: InputYamlFile | InputYamlText, decryptPassword?: string) {
  let root: any
  let yamlFile = await handleHttpFile(inp.yamlFile, decryptPassword)
  try {
    const s = lstatSync(yamlFile)
    if (s.isDirectory()) yamlFile = join(yamlFile, 'index.yaml' + (decryptPassword ? '.encrypt' : ''))
    if (!existsSync(yamlFile)) throw new Error()
  } catch (err) {
    throw new Error(`Could not found scenario file at "${yamlFile}"`)
  }
  Testcase.RootDir = dirname(yamlFile)
  let content: string
  if (inp instanceof InputYamlFile) {
    // load from file
    root = loadContent(yamlFile, '\0\0\0', decryptPassword)
  } else if (inp instanceof InputYamlText) {
    const { safeLoad } = require('js-yaml')
    // load from text content then set yaml file
    content = includeComment(inp.yamlText)
    root = safeLoad(content, { schema: SCHEMA })
  } else {
    throw new Error('Wrong input')
  }
  if (Array.isArray(root)) {
    root = {
      title: basename(yamlFile),
      description: yamlFile,
      decryptPassword,
      steps: root
    }
  }
  if (root.steps) root.steps = root.steps.flat()
  if (decryptPassword) root.decryptPassword = decryptPassword
  return new Testcase(root)
}

export async function execute(tc) {
  context.group('Environment: %s', context.Vars.env)
  context.groupEnd()
  context.group('Utils func: %s', '-------------------')
  context.log('- %s', Object.keys(context.Utils).join(','))
  context.groupEnd()
  context.group('Validate func: %s', '-------------------')
  context.log('- %s', 'https://www.chaijs.com/api/assert/')
  context.log('- %s', 'https://www.chaijs.com/api/bdd/')
  context.log('- %s', Object.keys(context.Validate).join(', '))
  context.groupEnd()
  context.log()
  await tc.exec()
}

export async function main(input: InputYamlFile | InputYamlText, decryptPassword?: string, initEnv?: string) {
  context.tc = await load(input, decryptPassword)
  const newVar = merge({}, context.Vars, JSON.parse(initEnv || '{}'))
  context.Vars = newVar
  await execute(context.tc)
  return context.tc
}

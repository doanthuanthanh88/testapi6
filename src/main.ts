import '@/components/data_handler/Validate';
import '@/components/Utils';
import axios from 'axios';
import { createWriteStream, existsSync, lstatSync } from 'fs';
import { safeLoad } from "js-yaml";
import { flatten, merge } from "lodash";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from 'path';
import { SCHEMA } from "./components";
import { Api } from "./components/api/Api";
import { includeComment, loadContent } from "./components/Import";
import { Tag } from './components/Tag';
import { Templates } from "./components/Templates";
import { Testcase } from "./components/Testcase";
import { context } from "./Context";

export class InputYamlFile {
  constructor(public yamlFile: string) { }
}
export class InputYamlText {
  constructor(public yamlText: string, public yamlFile: string) { }
}

export async function handleHttpFile(yamlFile: string, decryptPassword?: string) {
  if (yamlFile?.startsWith('http://') || yamlFile?.startsWith('https://')) {
    const response = await axios.get(yamlFile, { responseType: 'stream' });
    yamlFile = join(tmpdir(), `${context.Utils.random()}.yaml` + (decryptPassword ? '.encrypt' : ''))
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
  // Reset
  Testcase.RootDir = dirname(yamlFile)
  Templates.Templates = new Map()
  Testcase.APIs = []
  Tag.Cached.clear()
  Api.Index = 0

  let content: string
  if (inp instanceof InputYamlFile) {
    // load from file
    root = loadContent(yamlFile, '\0\0\0', decryptPassword)
  } else if (inp instanceof InputYamlText) {
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
  if (root.steps) root.steps = flatten(root.steps)
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

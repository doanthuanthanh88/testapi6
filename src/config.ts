import * as fs from 'fs'
import { merge } from 'lodash'

export function loadConfig(baseConfig: any, ...files: object[] | string[]) {
  const castToObject = function (obj, pro, prefix) {
    for (let k in obj) {
      if (typeof obj[k] === 'object') {
        obj[k] = castToObject(obj[k], pro, (prefix + k + '_').toLowerCase())
      } else if (Array.isArray(obj[k])) {
        for (let i in obj[k]) {
          obj[k][i] = castToObject(obj[k][i], pro, (prefix + k + '_' + i + '_').toLowerCase())
        }
      } else {
        let lk = prefix + k.toLowerCase().replace('.', '_')
        if (pro[lk] !== undefined && obj[k] !== undefined) {
          if (typeof obj[k] === 'boolean') {
            switch (pro[lk]) {
              case 'true':
                obj[k] = true
                break
              case '1':
                obj[k] = true
                break
              case 'yes':
                obj[k] = true
                break
              case 'false':
                obj[k] = false
                break
              case '0':
                obj[k] = false
                break
              case 'no':
                obj[k] = false
                break
              default:
                obj[k] = new Boolean(pro[lk]).valueOf()
                break
            }
          } else if (typeof obj[k] === 'number') {
            obj[k] = +pro[lk]
          } else {
            obj[k] = pro[lk]
          }
        }
      }
    }
    return obj
  }

  const config = {}
  files.forEach(file => {
    if (typeof file === 'string') {
      let env = {}
      try {
        if (file && fs.statSync(file)) {
          fs.readFileSync(file).toString().split('\n').map(e => e.trim()).filter(e => e && !e.startsWith('#')).forEach(e => {
            env[e.substr(0, e.indexOf('=')).trim().toLowerCase()] = e.substr(e.indexOf('=') + 1).trim()
          })
        }
      } catch (err) {
        console.warn(`Could not found config file at ${file}`)
      }
      merge(config, env)
    } else {
      merge(config, file)
    }
  })
  merge(config, Object.keys(process.env).reduce((sum, e) => {
    sum[e.toLowerCase()] = process.env[e]
    return sum
  }, {}))
  castToObject(baseConfig, config, '')
  if (baseConfig.NODE_ENV) process.env.NODE_ENV = baseConfig.NODE_ENV
  return baseConfig
}

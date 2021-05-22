import { URL } from 'url'
import { Method } from './Api'

export class CURLParser {
  static parse(curl: string) {
    const partition = []
    let tmp = []
    let isInQuote = ''
    curl.split('').forEach(c => {
      if (c === ' ') {
        if (isInQuote) {
          tmp.push(c)
        } else if (tmp.length) {
          partition.push(tmp.join(''))
          tmp = []
        }
      } else if (["'", '"'].includes(c)) {
        if (!isInQuote) {
          isInQuote = c
        } else if (isInQuote === c) {
          isInQuote = ''
          partition.push(tmp.join(''))
          tmp = []
        } else {
          tmp.push(c)
        }
      } else {
        tmp.push(c)
      }
    })
    if (tmp.length) {
      partition.push(tmp.join(''))
    }
    const rs = {
      method: undefined,
      headers: {},
      body: undefined,
      query: {},
      url: ''
    }
    const remain = []
    let temp = {
      method: '',
      headers: '',
      body: undefined
    }
    for (const p of partition) {
      if (['-x', '--request'].includes(p?.toLowerCase())) {
        if (!temp.method) {
          temp.method = p.trim()
        }
      } else if (temp.method) {
        rs.method = p.trim()
        temp.method = ''
      } else if (['-h', '--header'].includes(p?.toLowerCase())) {
        if (!temp.headers) {
          temp.headers = p.trim()
        }
      } else if (temp.headers) {
        const [k, vl] = p.split(':', 2)
        rs.headers[k.trim()] = vl.trim()
        temp.headers = ''
      } else if (['-d', '--data', '--data-ascii', '--data-binary', '--data-raw', '--data-urlencode'].includes(p?.toLowerCase())) {
        if (!rs.method) rs.method = Method.POST
        if (!temp.body) {
          temp.body = p.trim()
        }
      } else if (temp.body) {
        rs.body = p.trim()
        try {
          rs.body = JSON.parse(rs.body as any)
        } catch { } finally {
          temp.body = undefined
        }
      } else if (p?.trim().toLowerCase() === 'curl') {
        continue
      } else if (p?.trim().startsWith('-')) {
        continue
      } else {
        remain.push(p)
      }
    }
    if (remain[0]) {
      const url = new URL(remain[0].trim())
      rs.url = url.origin + url.pathname
      for (const [k, vl] of url.searchParams.entries()) {
        rs.query[k] = vl
      }
    }
    if (!rs.method) rs.method = Method.GET
    else rs.method = rs.method.toUpperCase()
    return rs
  }
}

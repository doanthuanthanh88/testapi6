import { Api, Method } from "./Api";

/**
 * Http DELETE request
 * 
 * ```yaml
 * - Delete:
 *     baseURL: http://abc.com
 *     url: /test/{class}
 *     headers:
 *       Authorization: Bearer ...
 *     query: 
 *       name: abc
 *     params:
 *       class*: A
 *     validate:
 *       - Status: [200, 204]
 * ```
 */
export class Delete extends Api {
  /** @ignore */
  body: any

  constructor(attrs: any) {
    super({ ...attrs, method: Method.DELETE })
  }
}
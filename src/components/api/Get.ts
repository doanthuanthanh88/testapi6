import { Api, Method } from "./Api";

/**
 * Http GET request
 * 
 * ```yaml
 * - Get:
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
 *     var: responseData
 * - Echo: ${responseData}
 * ```
 */
export class Get extends Api {
  /** @ignore */
  body: any

  constructor(attrs: any) {
    super({ ...attrs, method: Method.GET })
  }
}
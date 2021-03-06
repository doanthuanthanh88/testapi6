import { Api, Method } from "./Api";

/**
 * Http HEAD request
 * 
 * ```yaml
 * - Head:
 *     baseURL: http://abc.com
 *     url: /test/{class}
 *     headers:
 *       Authorization: Bearer ...
 *     query: 
 *       name: abc
 *     params:
 *       class*: A
 *     validate:
 *       - Status: 204
 * ```
 */
export class Head extends Api {

  init(attrs: any) {
    super.init({ ...attrs, method: Method.HEAD })
  }
}
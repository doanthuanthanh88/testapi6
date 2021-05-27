import { Api, Method } from "./Api";

/**
 * Http PATCH request
 * 
 * ```yaml
 * - Patch:
 *     baseURL: http://abc.com
 *     url: /test/{class}
 *     headers:
 *       Authorization: Bearer ...
 *     query: 
 *       name: abc
 *     params:
 *       class*: A
 *     body: {
 *        name: "abc"
 *     }
 *     validate:
 *       - Status: [200, 204]
 * ```
 */
export class Patch extends Api {
  constructor(attrs: any) {
    super({ ...attrs, method: Method.PATCH })
  }
}
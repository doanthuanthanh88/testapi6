import { Api, Method } from "./Api";

/**
 * Http POST request
 * 
 * ```yaml
 * - Post:
 *     baseURL: http://abc.com
 *     url: /upload
 *     headers:
 *       content-type: multipart/form-data
 *     body:
 *       name: img.jpg
 *       file: !upload examples/assets/text.txt
 *     query: 
 *       name: abc
 *     validate:
 *       - Status: [200, 204]
 * ```
 */
export class Post extends Api {

  constructor(attrs: any) {
    super({ ...attrs, method: Method.POST })
  }
}
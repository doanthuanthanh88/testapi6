import { Tag } from "../Tag";
import { loadContent } from '../Import'
import { Testcase } from "../Testcase";

/**
 * Load content from file then assign the value to some variables
 * 
 * ```yaml
 * - Load:
 *     title: load json file to object
 *     file: examples/assets/data.json
 *     var: rs
 * - Load:
 *     title: load csv file to object (a,b,c\nc,d,e)
 *     file: examples/assets/data.csv
 *     var: rs
 * - Load:
 *     title: load yaml file to object
 *     file: examples/assets/data.yaml
 *     var: rs
 * ```
 */
export class Load extends Tag {
  /** 
   * Set data after file loaded
   */
  var: string | object
  /**
   * File absolute or relative to load (.json, .yaml, .csv)
   */
  file: string

  constructor(attrs: any) {
    super(attrs)
  }

  exec() {
    const data = loadContent(Testcase.getPathFromRoot(this.file), this.tc.encryptPassword, this.tc.decryptPassword)
    if (this.var) this.setVar(this.var, data)
  }

}
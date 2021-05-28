import { context } from "@/Context";
import { Tag } from "../Tag";

/**
 * Clear screen
 * 
 * ```yaml
 * - Echo: Inspect ${obj}
 * - Clear 
 * - Echo:
 *     title: Debug object
 *     msg: ${obj}
 * ```
 */
export class Clear extends Tag {

  async exec() {
    context.clear()
  }
}
import { Exec } from "./Exec";

/**
 * Execute external command line
 * 
 * ```yaml
 * - PreExec:
 *     title: Push notification when test something wrong
 *     args:
 *       - echo
 *       - Run failed
 * ```
 */
export class PreExec extends Exec {
  preload = true 
}
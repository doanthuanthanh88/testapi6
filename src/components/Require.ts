import { Tag } from "@/components/Tag";
import { Testcase } from "@/components/Testcase";
import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { context } from "../Context";
import { Exec } from "./external/Exec";
import { ContentScript } from "./Script";

/**
 * Load external modules or javascript code
 *
 * Search modules (branches) at : https://github.com/doanthuanthanh88/testapi6-modules
 *
 * ```yaml
 * - Require:
 *     root: /home/user
 *     modules:
 *       - ./my-librarry/dist/index.js
 *       - /home/user/my-librarry/dist/index.js
 *     code: |
 *       Vars.url = http://test_url_here
 *       Validate.globalCheck = () => true
 * ```
 */
export class Require extends Tag {
  private static ExternalModules = new Set<string>();

  preload = true;
  /**
   * Root path where modules are installed
   * - npm: It auto load in npm global packages, prefix and binaries
   * - yarn: It auto load in yarn global packages, prefix and binaries
   * - "": It combine npm and yarn
   * - /PATH_TO_MODULE: It auto load from this path
   */
  root: string;
  /** External modules */
  modules: string[];
  /**
   * Javascript code
   * ```yaml
   * Embed variables:
   *   - Vars: Global variable
   *   - Validate: Global validators
   *   - ExternalLibraries: External module library
   *   - Utils: Global utility functions
   *   - Context: Global context
   *   - $: this
   *   - $$: parent which wrap this tag
   * ```
   * */
  code: ContentScript;

  init(attrs: any, ...props: any[]) {
    if (Array.isArray(attrs)) {
      attrs = {
        modules: attrs,
      };
    }
    return super.init(attrs, ...props);
  }

  static async getLibPaths(root?: string) {
    const libPaths = [];
    if (root) {
      libPaths.push(Testcase.getPathFromRoot(root));
    }
    libPaths.push("");
    if (!root) {
      await Promise.all([
        (async () => {
          try {
            const exec = new Exec();
            exec.init({
              slient: true,
              args: ["npm", "root", "-g"],
              success: [],
            });
            await exec.exec();
            libPaths.push(
              ...exec.success
                .map((f) => f?.trim())
                .filter((f) => f && existsSync(f))
            );
          } catch (err) {
            console.error(err);
          }
        })(),
        (async () => {
          try {
            const exec = new Exec();
            exec.init({
              slient: true,
              args: ["yarn", "global", "dir"],
              success: [],
            });
            await exec.exec();
            libPaths.push(
              ...exec.success
                .map((f) => {
                  f = f?.trim();
                  return f ? join(f, "node_modules") : f;
                })
                .filter((f) => f && existsSync(f))
            );
          } catch (err) {
            console.error(err);
          }
        })(),
      ]);
    }
    return libPaths;
  }

  static async getPathGlobalModule(name: string, root?: string) {
    const libPaths = await Require.getLibPaths(root);
    let modulePath = undefined;
    for (const i in libPaths) {
      modulePath = join(libPaths[i], name);
      try {
        require.resolve(modulePath);
        return modulePath;
      } catch { }
    }
    throw new Error(
      `Please install module "${name}" \n    \`npm install -g ${name}\` \n OR \n    \`yarn global add ${name}\``
    );
  }

  static async loadExternalLib(root: string, ...modules: string[]) {
    for (const p of modules) {
      if (Require.ExternalModules.has(p)) {
        continue;
      }
      Require.ExternalModules.add(p);

      let obj: any;
      let modulePath = "System";
      try {
        modulePath = await Require.getPathGlobalModule(p, root);
        obj = require(modulePath);

        const packageJson = JSON.parse(readFileSync(join(modulePath, 'package.json')).toString())
        console.log(chalk.bold.gray(`${packageJson.name} (v${packageJson.version})`), chalk.gray.underline(packageJson.repository?.url || ''), chalk.italic.gray(`${packageJson.description || ''}`))
        console.group()
        for (let k in obj) {
          if (context.ExternalLibraries[k]) {
            context.log(
              chalk.yellow(
                `Warn: Tag ${k} has declared. Could not redeclare in ${modulePath}`
              )
            );
          }
          context.ExternalLibraries[k] = obj[k];
          context.log(chalk.gray.bold('- ' + k), chalk.italic.gray(`(${modulePath})`));
        }

        console.groupEnd()
      } catch (err) {
        context.error(chalk.red(err.message));
        throw err;
      }

    }
  }

  async exec() {
    if (this.modules) {
      context.group("Installed external modules");
      await Require.loadExternalLib(this.root, ...this.modules);
      context.groupEnd();
    }

    if (this.code) {
      // @ts-ignore
      const $ = this;
      // @ts-ignore
      const $$ = this.$$;
      // @ts-ignore
      const { Vars, Validate, ExternalLibraries, Utils } = context;
      // @ts-ignore
      const Context = context;
      await eval(this.code);
    }
  }
}

import chalk from "chalk";
import { program } from "commander";
import { existsSync } from "fs";
import { join } from "path";
import { context } from "./Context";

export class Helper {
  yamlFile: string
  password: string
  env: any

  constructor() {

  }

  async exec() {
    const packageJson = [
      join(__dirname, "../package.json"),
      join(__dirname, "./package.json"),
    ].find((src) => existsSync(src));
    const { version, description, name, repository } = require(packageJson);
    const self = this
    const cmd = await program
      .name(name)
      .description(description)
      .version(version, "-v, --version")
      .argument("<file>", "Scenario path or file", undefined, "index.yaml")
      .argument("[password]", "Password to decrypt scenario file")
      .enablePositionalOptions(true)
      .passThroughOptions(true)
      .option(
        "-e, --env <csv|json>",
        `Environment variables.    
                        + csv: key1=value1;key2=value2
                        + json: {"key1": "value1", "key2": "value2"}`
      )
      // .showHelpAfterError(true)
      .addCommand(
        program
          .createCommand('run')
          .description('Execute scenario file (Default)')
          .action((_, cmd) => {
            [this.yamlFile, this.password] = cmd.args
          }),
        { isDefault: true, hidden: true }
      )
      .addCommand(program
        .createCommand('help')
        .description('Show module helper')
        .action(async (_, { args }) => {
          const [moduleName] = args
          const { Require } = await import("@/components/Require");
          await Require.loadExternalLib(undefined, moduleName);
          const { Input } = await import("@/components/input/Input");
          const input = new Input()
          await input.init({
            title: `Show help`,
            type: 'select',
            choices: Object.keys(context.ExternalLibraries).map(key => {
              return {
                title: `- ${chalk.bold(key)}: ${chalk.italic(context.ExternalLibraries[key].des || '')}`,
                value: key
              }
            })
          })
          await input.prepare()
          await input.beforeExec()
          const clazz = await input.exec()
          if (context.ExternalLibraries[clazz]) {
            if (context.ExternalLibraries[clazz].example) {
              console.log(chalk.magenta(context.ExternalLibraries[clazz].example))
            } else {
              console.log(chalk.yellow('No example'))
            }
          }
          process.exit(0)
        })
      )
      .addHelpText("after", `More: \n  ${repository.url} `)
      .parseAsync(process.argv)

    self.env = cmd.opts();
    if (self.env && typeof self.env === "string") {
      try {
        self.env = JSON.parse(self.env);
      } catch {
        self.env = self.env
          .trim()
          .split(";")
          .reduce((sum, e) => {
            e = e.trim();
            if (e) {
              const idx = e.indexOf("=");
              if (idx !== -1) sum[e.substr(0, idx)] = e.substr(idx + 1);
            }
            return sum;
          }, {});
      }
    }
  }
}

import { Command, program } from "commander";
import { existsSync } from "fs";
import { join } from "path";

export class Helper {
  cmd: Command;
  env: any;

  constructor() {
    const packageJson = [
      join(__dirname, "../package.json"),
      join(__dirname, "./package.json"),
    ].find((src) => existsSync(src));
    const { version, description, name, repository } = require(packageJson);

    this.cmd = program
      .name(name)
      .version(version, "", description)
      .argument("<file>", "Scenario path or file", undefined, "index.yaml")
      .argument("[password]", "Password to decrypt scenario file")
      .option(
        "-e, --env <csv|json>",
        `Environment variables.    
                        + csv: key1=value1;key2=value2
                        + json: {"key1": "value1", "key2": "value2"}`
      )
      .addHelpText("after", `More:\n  ${repository.url}`)
      .parse(process.argv);

    this.env = this.cmd.opts();
    if (this.env && typeof this.env === "string") {
      try {
        this.env = JSON.parse(this.env);
      } catch {
        this.env = this.env
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

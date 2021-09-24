import "./init";
import { InputYamlFile, main } from "@/main";
import { Helper } from "./Helper";
import { url } from "inspector";

(async () => {
  const helper = new Helper();
  await helper.exec()

  if (url()) {
    console.log("-", "Debug mode!");
    setTimeout(() => {
      // Handle scenario file
      main(new InputYamlFile(helper.yamlFile), helper.password, helper.env);
    }, 1000);
  } else {
    // Handle scenario file
    main(new InputYamlFile(helper.yamlFile), helper.password, helper.env);
  }

})()

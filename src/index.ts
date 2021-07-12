import './init'
import { InputYamlFile, main } from '@/main'

// main(new InputYamlFile(process.argv[2]), process.argv[3], process.argv[4])

setTimeout(async () => {
  main(new InputYamlFile(process.argv[2]), process.argv[3], process.argv[4])
}, 500)

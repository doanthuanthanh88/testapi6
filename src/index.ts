import { InputYamlFile, main } from '@/main'
import './init'


main(new InputYamlFile(process.argv[2]), process.argv[3], process.argv[4])

// (async () => {
//   await main(new InputYamlText('- !echo thanh', process.argv[2]))
//   console.log('here', context.tc)
// })()

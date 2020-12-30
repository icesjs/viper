const { log, createPrefixedLogger } = require('./lib/logger')
const { printErrorAndExit } = require('./lib/logger')
const { pack, getCommandArgs } = require('./pack')

//
run().catch(printErrorAndExit)

async function run() {
  const args = getCommandArgs()
  await pack(args)
}

import log from '@common/utils/nodeLog'

const ignoreErrorMessage = [
  'Possible side-effect in debug-evaluate',
  'Unexpected end of input',
]

process.on('uncaughtException', err => {
  if (ignoreErrorMessage.includes(err?.message)) return
  console.error('An uncaught error occurred!')
  console.error(err)
  log.error(err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at: Promise ', promise)
  console.error(' reason: ', reason)
  log.error(reason)
})

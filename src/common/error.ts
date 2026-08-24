const ignoreErrorMessage = [
  'Possible side-effect in debug-evaluate',
  'Unexpected end of input',
]

window.addEventListener('error', event => {
  if (ignoreErrorMessage.includes(event.message)) return
  console.error('An uncaught error occurred!')
  console.error(event.error ?? event.message)
})
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled Rejection at: Promise ', event.promise)
  console.error(' reason: ', event.reason)
})

export {}

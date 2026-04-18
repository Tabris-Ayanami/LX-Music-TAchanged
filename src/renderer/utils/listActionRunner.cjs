const runListAction = ({
  beforeAction,
  closeMenu,
  action,
} = {}) => {
  beforeAction?.()
  closeMenu?.()
  return action?.()
}

module.exports = {
  runListAction,
}

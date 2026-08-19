export const shouldOpenUserApiDevTools = (
  nodeEnv: string | undefined,
  cmdParams: LX.CmdParams,
): boolean => nodeEnv === 'development' || cmdParams.odt === true

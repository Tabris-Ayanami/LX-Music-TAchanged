export const langS2T = async(str: string) => {
  return window.lx.worker.main.langS2t(Buffer.from(str).toString('base64')).then(b64 => Buffer.from(b64, 'base64').toString())
}

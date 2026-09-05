export interface NcmApiRequestParams {
  endpoint: string
  params?: Record<string, unknown>
}

export interface NcmApiResponse<TBody = unknown> {
  status: number
  body: TBody
  cookie: string[]
}

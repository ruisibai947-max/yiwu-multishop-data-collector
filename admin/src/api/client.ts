export type ShopSummary = {
  id: string
  platform: string
  accountId: string
  accountName: string
  shopName: string
  browserProfileName: string
  currency: string | null
  timezone: string | null
  status: 'active' | 'paused'
}

export type ArtifactSummary = {
  id: string
  jobId: string
  artifactType: string
  sha256: string
  byteSize: number
  createdAt: string
  downloadUrl: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `Request failed: ${response.status}`
    throw new Error(message)
  }
  return (await response.json()) as T
}

export function getShops(): Promise<ShopSummary[]> {
  return request('/api/shops')
}

export function getJobs<T>(): Promise<T[]> {
  return request('/api/jobs')
}

export function retryJob<T>(jobId: string): Promise<T> {
  return request(`/api/jobs/${jobId}/retry`, { method: 'POST' })
}

export function getArtifacts(jobId: string): Promise<ArtifactSummary[]> {
  return request(`/api/jobs/${jobId}/artifacts`)
}

export function createManualJob(payload: {
  accountId: string
  shopId: string
  datasetCode: string
  businessFrom: string
  businessTo: string
}): Promise<{ id: string; status: string }> {
  return request('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function uploadManualArtifact(
  form: FormData,
): Promise<{ id: string; status: string }> {
  return request('/api/manual-artifacts', {
    method: 'POST',
    body: form,
  })
}

export function getSystemStatus(): Promise<{ jobPickupPaused: boolean }> {
  return request('/api/system/status')
}

export function setSystemPaused(
  paused: boolean,
): Promise<{ jobPickupPaused: boolean }> {
  return request(paused ? '/api/system/pause' : '/api/system/resume', {
    method: 'POST',
  })
}

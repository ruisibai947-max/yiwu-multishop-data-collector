import { useEffect, useState } from 'react'
import {
  getShops,
  type ShopSummary,
  uploadManualArtifact,
} from '../api/client'

export function ManualArtifactPage() {
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [shopId, setShopId] = useState('')
  const [datasetCode, setDatasetCode] = useState('finance_daily')
  const [businessFrom, setBusinessFrom] = useState('')
  const [businessTo, setBusinessTo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void getShops().then((items) => {
      const active = items.filter((item) => item.status === 'active')
      setShops(active)
      setShopId(active[0]?.id ?? '')
    })
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const shop = shops.find((item) => item.id === shopId)
    if (!shop || !file) return
    const form = new FormData()
    form.set('accountId', shop.accountId)
    form.set('shopId', shopId)
    form.set('datasetCode', datasetCode)
    form.set('businessFrom', businessFrom)
    form.set('businessTo', businessTo)
    form.set('file', file)
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await uploadManualArtifact(form)
      setMessage(`文件已归档并解析，任务 ${result.id} 状态：${result.status}`)
    } catch (error) {
      setMessage(
        `校验未通过：${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">MANUAL EXPORT FALLBACK / VALIDATED INGESTION</span>
          <h1>人工报表</h1>
        </div>
        <p>平台自动采集暂不可用时，上传官方导出的 CSV、XLSX 或 JSON，仍走相同校验、隔离与幂等入库流程。</p>
      </div>

      <form className="panel form-panel" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="artifact-shop">平台 / 账号 / 店铺</label>
            <select id="artifact-shop" value={shopId} onChange={(event) => setShopId(event.target.value)} required>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.platform} / {shop.accountName} / {shop.shopName}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="artifact-dataset">已批准数据集</label>
            <select id="artifact-dataset" value={datasetCode} onChange={(event) => setDatasetCode(event.target.value)}>
              <option value="finance_daily">经营财务日报</option>
              <option value="product_link_daily">商品链接表现</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="artifact-from">业务开始日期</label>
            <input id="artifact-from" type="date" value={businessFrom} onChange={(event) => setBusinessFrom(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="artifact-to">业务结束日期</label>
            <input id="artifact-to" type="date" value={businessTo} onChange={(event) => setBusinessTo(event.target.value)} required />
          </div>
          <div className="field full">
            <label htmlFor="artifact-file">官方导出文件</label>
            <label className="file-drop" htmlFor="artifact-file">
              <span>{file ? file.name : '选择 CSV、XLSX 或 JSON 文件'}</span>
              <input
                id="artifact-file"
                type="file"
                accept=".csv,.xlsx,.json"
                hidden
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={submitting || !file || !shopId}>
            {submitting ? '正在归档并校验' : '上传并解析'}
          </button>
          <span className="mono">失败文件会进入隔离区，不写入经营数据</span>
        </div>
        {message && <p className={`notice ${message.startsWith('文件已') ? 'success' : 'error'}`}>{message}</p>}
      </form>
    </section>
  )
}

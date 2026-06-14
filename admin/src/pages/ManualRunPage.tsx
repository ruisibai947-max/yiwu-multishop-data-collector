import { useEffect, useState } from 'react'
import {
  createManualJob,
  getShops,
  type ShopSummary,
} from '../api/client'

export function ManualRunPage() {
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [shopId, setShopId] = useState('')
  const [datasetCode, setDatasetCode] = useState('finance_daily')
  const [businessFrom, setBusinessFrom] = useState('')
  const [businessTo, setBusinessTo] = useState('')
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
    if (!shop) return
    setSubmitting(true)
    setMessage(null)
    try {
      const job = await createManualJob({
        accountId: shop.accountId,
        shopId,
        datasetCode,
        businessFrom,
        businessTo,
      })
      setMessage(`任务 ${job.id} 已进入队列，当前状态：${job.status}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">MANUAL TRIGGER / SAME COLLECTION PIPELINE</span>
          <h1>手动采集</h1>
        </div>
        <p>用于临时补采、登录恢复后的验证，以及定时任务之外的指定日期重跑。</p>
      </div>

      <form className="panel form-panel" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="shop">平台 / 账号 / 店铺</label>
            <select id="shop" value={shopId} onChange={(event) => setShopId(event.target.value)} required>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.platform} / {shop.accountName} / {shop.shopName}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="dataset">数据集</label>
            <select id="dataset" value={datasetCode} onChange={(event) => setDatasetCode(event.target.value)}>
              <option value="finance_daily">经营财务日报</option>
              <option value="product_link_daily">商品链接表现</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="from">业务开始日期</label>
            <input id="from" type="date" value={businessFrom} onChange={(event) => setBusinessFrom(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="to">业务结束日期</label>
            <input id="to" type="date" value={businessTo} onChange={(event) => setBusinessTo(event.target.value)} required />
          </div>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={submitting || !shopId}>
            {submitting ? '正在创建任务' : '创建采集任务'}
          </button>
          <span className="mono">不会中断正在运行的其他店铺</span>
        </div>
        {message && <p className={`notice ${message.includes('已进入') ? 'success' : 'error'}`}>{message}</p>}
      </form>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { getShops, type ShopSummary } from '../api/client'

export function ShopsPage() {
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getShops()
      .then(setShops)
      .finally(() => setLoading(false))
  }, [])

  const platformCount = useMemo(
    () => new Set(shops.map((shop) => shop.platform)).size,
    [shops],
  )

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">ACCOUNT MATRIX / BITBROWSER PROFILES</span>
          <h1>店铺与账号</h1>
        </div>
        <p>
          一个登录账号绑定一个比特浏览器环境；同一账号下的多个店铺共享登录态，但采集任务仍按店铺隔离。
        </p>
      </div>

      <div className="metric-strip">
        <div className="metric-item">
          <span>平台数量</span>
          <strong>{platformCount}</strong>
        </div>
        <div className="metric-item">
          <span>店铺数量</span>
          <strong>{shops.length}</strong>
        </div>
        <div className="metric-item">
          <span>正常运行</span>
          <strong>{shops.filter((shop) => shop.status === 'active').length}</strong>
        </div>
        <div className="metric-item">
          <span>已暂停</span>
          <strong>{shops.filter((shop) => shop.status === 'paused').length}</strong>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="loading-state">正在读取店铺配置...</div>
        ) : shops.length === 0 ? (
          <div className="empty-state">尚未配置店铺，请先通过管理 API 建立账号关系。</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>平台</th>
                  <th>账号</th>
                  <th>店铺</th>
                  <th>比特浏览器环境</th>
                  <th>币种 / 时区</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td><strong>{shop.platform}</strong></td>
                    <td>{shop.accountName}</td>
                    <td>{shop.shopName}</td>
                    <td className="mono">{shop.browserProfileName}</td>
                    <td className="mono">
                      {shop.currency ?? '—'} / {shop.timezone ?? '—'}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          shop.status === 'active'
                            ? 'status-succeeded'
                            : 'status-failed'
                        }`}
                      >
                        {shop.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

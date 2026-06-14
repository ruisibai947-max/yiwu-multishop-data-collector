import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobs, retryJob } from '../api/client'

export type JobSummary = {
  id: string
  platform: string
  accountName: string
  shopName: string | null
  datasetCode: string
  triggerType: 'scheduled' | 'manual' | 'retry'
  status: 'queued' | 'running' | 'waiting_auth' | 'failed' | 'succeeded'
  checkpoint: string | null
  startedAt: string | null
  finishedAt: string | null
  errorMessage?: string | null
}

type JobsPageProps = {
  initialJobs?: JobSummary[]
}

const filters = [
  ['all', '全部'],
  ['running', '运行中'],
  ['succeeded', '成功'],
  ['waiting_auth', '待登录'],
  ['failed', '失败'],
] as const

function timeLabel(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function JobsPage({ initialJobs }: JobsPageProps) {
  const [jobs, setJobs] = useState<JobSummary[]>(initialJobs ?? [])
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all')
  const [loading, setLoading] = useState(initialJobs === undefined)
  const [retrying, setRetrying] = useState<string | null>(null)

  useEffect(() => {
    if (initialJobs) return
    void getJobs<JobSummary>()
      .then(setJobs)
      .finally(() => setLoading(false))
  }, [initialJobs])

  const visibleJobs = useMemo(
    () =>
      filter === 'all'
        ? jobs
        : jobs.filter((job) =>
            filter === 'running'
              ? job.status === 'running' || job.status === 'queued'
              : job.status === filter,
          ),
    [filter, jobs],
  )

  const counts = useMemo(
    () => ({
      total: jobs.length,
      succeeded: jobs.filter((job) => job.status === 'succeeded').length,
      blocked: jobs.filter(
        (job) => job.status === 'failed' || job.status === 'waiting_auth',
      ).length,
      active: jobs.filter(
        (job) => job.status === 'running' || job.status === 'queued',
      ).length,
    }),
    [jobs],
  )

  async function handleRetry(jobId: string) {
    setRetrying(jobId)
    try {
      const updated = await retryJob<JobSummary>(jobId)
      setJobs((current) =>
        current.map((job) => (job.id === jobId ? updated : job)),
      )
    } finally {
      setRetrying(null)
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">COLLECTION CONTROL / LIVE QUEUE</span>
          <h1>采集任务</h1>
        </div>
        <p>
          每个任务独立记录登录、归档、解析与入库检查点。单账号异常不会阻塞其他平台和店铺。
        </p>
      </div>

      <div className="metric-strip">
        <div className="metric-item">
          <span>当前任务</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="metric-item">
          <span>成功入库</span>
          <strong>{counts.succeeded}</strong>
        </div>
        <div className="metric-item">
          <span>正在执行</span>
          <strong>{counts.active}</strong>
        </div>
        <div className="metric-item">
          <span>需要处理</span>
          <strong>{counts.blocked}</strong>
        </div>
      </div>

      <div className="panel">
        <div className="panel-toolbar">
          <div className="filter-group" aria-label="任务筛选">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'active' : ''}
                type="button"
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="mono">AUTO REFRESH / 60S</span>
        </div>

        {loading ? (
          <div className="loading-state">正在读取本地任务队列...</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>平台 / 店铺</th>
                  <th>触发方式</th>
                  <th>状态</th>
                  <th>检查点</th>
                  <th>开始 / 完成</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={job.id} data-testid={`job-${job.id}`}>
                    <td className="platform-cell">
                      <strong>{job.platform}</strong>
                      <span>{job.shopName ?? job.accountName}</span>
                    </td>
                    <td>
                      <span className="mono">{job.triggerType}</span>
                    </td>
                    <td>
                      <span
                        className={`status-badge status-${job.status}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="mono">{job.checkpoint ?? 'not_started'}</td>
                    <td className="mono">
                      {timeLabel(job.startedAt)}
                      <br />
                      {timeLabel(job.finishedAt)}
                    </td>
                    <td>
                      <div className="action-group">
                        <Link to={`/jobs/${job.id}`}>详情</Link>
                        {(job.status === 'failed' ||
                          job.status === 'waiting_auth') && (
                          <button
                            className="text-button danger"
                            type="button"
                            disabled={retrying === job.id}
                            onClick={() => void handleRetry(job.id)}
                          >
                            重试
                          </button>
                        )}
                        {job.status === 'succeeded' && (
                          <>
                            <Link to={`/jobs/${job.id}`}>原始文件</Link>
                            <a
                              href={`/preview/${job.datasetCode}/`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              预览
                            </a>
                          </>
                        )}
                      </div>
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

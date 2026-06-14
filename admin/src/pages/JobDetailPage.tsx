import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getArtifacts,
  getJobs,
  type ArtifactSummary,
} from '../api/client'
import type { JobSummary } from './JobsPage'

export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const [job, setJob] = useState<JobSummary | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([])

  useEffect(() => {
    void Promise.all([getJobs<JobSummary>(), getArtifacts(jobId)]).then(
      ([jobs, files]) => {
        setJob(jobs.find((item) => item.id === jobId) ?? null)
        setArtifacts(files)
      },
    )
  }, [jobId])

  if (!job) {
    return <div className="loading-state">正在读取任务详情...</div>
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <span className="eyebrow">JOB TRACE / {job.id}</span>
          <h1>{job.platform} · {job.shopName ?? job.accountName}</h1>
        </div>
        <Link className="secondary-button" to="/jobs">返回任务列表</Link>
      </div>

      <div className="detail-grid">
        <div className="panel detail-section">
          <h2>采集执行轨迹</h2>
          <dl className="definition-list">
            <dt>数据集</dt><dd>{job.datasetCode}</dd>
            <dt>触发方式</dt><dd>{job.triggerType}</dd>
            <dt>任务状态</dt>
            <dd><span className={`status-badge status-${job.status}`}>{job.status}</span></dd>
            <dt>当前检查点</dt><dd className="mono">{job.checkpoint ?? 'not_started'}</dd>
            <dt>开始时间</dt><dd className="mono">{job.startedAt ?? '—'}</dd>
            <dt>完成时间</dt><dd className="mono">{job.finishedAt ?? '—'}</dd>
            <dt>安全错误信息</dt><dd>{job.errorMessage ?? '无'}</dd>
            <dt>发布状态</dt><dd>由发布任务独立跟踪，不影响本次采集结果</dd>
          </dl>
        </div>

        <div className="panel detail-section">
          <h2>原始证据与截图</h2>
          <div className="artifact-list">
            {artifacts.length === 0 ? (
              <div className="empty-state">尚无归档文件</div>
            ) : (
              artifacts.map((artifact) => (
                <div className="artifact-row" key={artifact.id}>
                  <div>
                    <strong>{artifact.artifactType.toUpperCase()}</strong>
                    <div className="mono">{artifact.sha256.slice(0, 16)}…</div>
                  </div>
                  <a href={artifact.downloadUrl}>下载</a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

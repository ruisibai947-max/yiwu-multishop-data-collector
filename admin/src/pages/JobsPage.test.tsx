import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { JobsPage, type JobSummary } from './JobsPage'

const jobs: JobSummary[] = [
  {
    id: 'job-temu',
    platform: 'Temu',
    accountName: 'Account A',
    shopName: 'Shop A',
    datasetCode: 'finance_daily',
    triggerType: 'scheduled',
    status: 'succeeded',
    checkpoint: 'stored',
    startedAt: '2026-06-14T01:00:00.000Z',
    finishedAt: '2026-06-14T01:02:00.000Z',
  },
  {
    id: 'job-shein',
    platform: 'Shein',
    accountName: 'Account B',
    shopName: 'Shop B',
    datasetCode: 'finance_daily',
    triggerType: 'scheduled',
    status: 'waiting_auth',
    checkpoint: 'session_ready',
    startedAt: '2026-06-14T01:00:00.000Z',
    finishedAt: null,
  },
  {
    id: 'job-jd',
    platform: 'JD',
    accountName: 'Account C',
    shopName: 'Shop C',
    datasetCode: 'finance_daily',
    triggerType: 'manual',
    status: 'failed',
    checkpoint: 'artifact_archived',
    startedAt: '2026-06-14T01:00:00.000Z',
    finishedAt: '2026-06-14T01:01:00.000Z',
  },
]

describe('JobsPage', () => {
  it('shows retry actions for blocked jobs and outputs for successful jobs', () => {
    render(
      <MemoryRouter>
        <JobsPage initialJobs={jobs} />
      </MemoryRouter>,
    )

    const temu = screen.getByTestId('job-job-temu')
    expect(within(temu).getByText('succeeded')).toBeInTheDocument()
    expect(within(temu).getByRole('link', { name: '原始文件' })).toBeInTheDocument()
    expect(within(temu).getByRole('link', { name: '预览' })).toBeInTheDocument()

    for (const id of ['job-shein', 'job-jd']) {
      const row = screen.getByTestId(`job-${id}`)
      expect(within(row).getByRole('button', { name: '重试' })).toBeInTheDocument()
    }
  })
})

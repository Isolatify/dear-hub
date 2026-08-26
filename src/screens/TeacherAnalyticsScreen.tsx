import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { GlassCard, Spinner, Avatar } from '@/components/ui';
import type { Dear, DearSubmission, Profile } from '@/types';
import { BarChart3, TrendingUp, Users, Zap } from 'lucide-react';

interface DearStat {
  dear: Dear;
  total: number;
  passed: number;
  failed: number;
  pending: number;
  submissionRate: number;
}

interface Performer {
  profile: Profile;
  passed: number;
  total: number;
}

export function TeacherAnalyticsScreen() {
  const [dears, setDears] = useState<Dear[]>([]);
  const [submissions, setSubmissions] = useState<DearSubmission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: d }, { data: s }, { data: p }] = await Promise.all([
        supabase.from('dears').select('*').order('created_at', { ascending: false }),
        supabase.from('dear_submissions').select('*'),
        supabase.from('profiles').select('*').eq('role', 'student'),
      ]);
      setDears((d ?? []) as Dear[]);
      setSubmissions((s ?? []) as DearSubmission[]);
      setProfiles((p ?? []) as Profile[]);
      setLoading(false);
    };
    load();
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  // ── Compute stats per DEAR ──
  const dearStats = useMemo<DearStat[]>(() => {
    return dears.map((dear) => {
      const subs = submissions.filter((s) => s.dear_id === dear.id);
      const total = subs.length;
      const passed = subs.filter((s) => s.status === 'approved').length;
      const failed = subs.filter((s) => s.status === 'failed').length;
      const pending = total - passed - failed;
      const submissionRate = total > 0 ? Math.round(((subs.filter((s) => ['submitted', 'approved', 'failed'].includes(s.status)).length) / total) * 100) : 0;
      return { dear, total, passed, failed, pending, submissionRate };
    });
  }, [dears, submissions]);

  // ── Overall stats ──
  const totalSubmissions = submissions.length;
  const totalPassed = submissions.filter((s) => s.status === 'approved').length;
  const totalFailed = submissions.filter((s) => s.status === 'failed').length;
  const totalPending = totalSubmissions - totalPassed - totalFailed;
  const submissionRate = totalSubmissions > 0 ? Math.round((submissions.filter((s) => ['submitted', 'approved', 'failed'].includes(s.status)).length / totalSubmissions) * 100) : 0;
  const passRate = totalSubmissions > 0 ? Math.round((totalPassed / totalSubmissions) * 100) : 0;

  const scoredSubs = submissions.filter((s) => s.ai_score != null);
  const avgAiScore = scoredSubs.length > 0
    ? Math.round(scoredSubs.reduce((acc, s) => acc + (s.ai_score!.human_probability ?? 0), 0) / scoredSubs.length)
    : null;

  // ── Top performers ──
  const performers = useMemo<Performer[]>(() => {
    const map = new Map<string, { passed: number; total: number }>();
    submissions.forEach((s) => {
      const cur = map.get(s.student_id) ?? { passed: 0, total: 0 };
      cur.total++;
      if (s.status === 'approved') cur.passed++;
      map.set(s.student_id, cur);
    });
    const result: Performer[] = [];
    map.forEach((val, key) => {
      const profile = profileMap.get(key);
      if (profile) result.push({ profile, passed: val.passed, total: val.total });
    });
    return result.sort((a, b) => b.passed - a.passed || b.total - a.total);
  }, [submissions, profileMap]);

  // ── Max values for chart scaling ──
  const maxSubsPerDear = Math.max(1, ...dearStats.map((d) => d.total));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto analytics-page">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-app-primary">Analytics</h1>
        <p className="text-app-secondary mt-1">Class performance insights</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  STAT CARDS                                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GlassCard className="analytics-stat-card">
          <div className="analytics-stat-icon analytics-stat-icon-blue">
            <BarChart3 size={20} />
          </div>
          <div className="analytics-stat-info">
            <span className="analytics-stat-label">Total Submissions</span>
            <span className="analytics-stat-value">{totalSubmissions}</span>
            <span className="analytics-stat-desc">All assignments</span>
          </div>
        </GlassCard>

        <GlassCard className="analytics-stat-card">
          <div className="analytics-stat-icon analytics-stat-icon-green">
            <TrendingUp size={20} />
          </div>
          <div className="analytics-stat-info">
            <span className="analytics-stat-label">Submission Rate</span>
            <span className="analytics-stat-value">{submissionRate}%</span>
            <span className="analytics-stat-desc">{submissions.filter((s) => ['submitted', 'approved', 'failed'].includes(s.status)).length} submitted</span>
          </div>
        </GlassCard>

        <GlassCard className="analytics-stat-card">
          <div className="analytics-stat-icon analytics-stat-icon-amber">
            <Zap size={20} />
          </div>
          <div className="analytics-stat-info">
            <span className="analytics-stat-label">Pass Rate</span>
            <span className="analytics-stat-value">{passRate}%</span>
            <span className="analytics-stat-desc">{totalPassed} passed · {totalFailed} failed</span>
          </div>
        </GlassCard>

        <GlassCard className="analytics-stat-card">
          <div className="analytics-stat-icon analytics-stat-icon-purple">
            <Users size={20} />
          </div>
          <div className="analytics-stat-info">
            <span className="analytics-stat-label">Avg AI Score</span>
            <span className="analytics-stat-value">{avgAiScore !== null ? `${avgAiScore}%` : 'N/A'}</span>
            <span className="analytics-stat-desc">From {scoredSubs.length} scored</span>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  SUBMISSIONS PER DEAR                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <GlassCard className="analytics-chart-card">
          <h2 className="analytics-chart-title">Submissions per DEAR</h2>
          <div className="analytics-bar-chart">
            {dearStats.length === 0 ? (
              <div className="analytics-empty">No DEARs yet</div>
            ) : (
              dearStats.map((ds) => {
                const label = ds.dear.week && ds.dear.term ? `${ds.dear.week} —/${ds.dear.term}` : ds.dear.week || ds.dear.id.slice(0, 6);
                const height = maxSubsPerDear > 0 ? (ds.total / maxSubsPerDear) * 100 : 0;
                return (
                  <div key={ds.dear.id} className="analytics-bar-col">
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-fill"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="analytics-bar-label">{label}</span>
                    <span className="analytics-bar-value">{ds.total}</span>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  GRADE DISTRIBUTION                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <GlassCard className="analytics-chart-card">
          <h2 className="analytics-chart-title">Grade Distribution</h2>
          <div className="analytics-grade-section">
            {/* Stacked bar */}
            <div className="analytics-grade-bar-wrap">
              <div className="analytics-grade-bar">
                {totalSubmissions > 0 && totalFailed > 0 && (
                  <div
                    className="analytics-grade-segment analytics-grade-failed"
                    style={{ width: `${(totalFailed / totalSubmissions) * 100}%` }}
                  />
                )}
                {totalSubmissions > 0 && totalPending > 0 && (
                  <div
                    className="analytics-grade-segment analytics-grade-pending"
                    style={{ width: `${(totalPending / totalSubmissions) * 100}%` }}
                  />
                )}
                {totalSubmissions > 0 && totalPassed > 0 && (
                  <div
                    className="analytics-grade-segment analytics-grade-passed"
                    style={{ width: `${(totalPassed / totalSubmissions) * 100}%` }}
                  />
                )}
              </div>
            </div>
            {/* Legend */}
            <div className="analytics-grade-legend">
              <div className="analytics-grade-legend-item">
                <span className="analytics-grade-dot analytics-grade-failed" />
                <span>Failed</span>
                <span className="analytics-grade-count">{totalFailed}</span>
              </div>
              <div className="analytics-grade-legend-item">
                <span className="analytics-grade-dot analytics-grade-pending" />
                <span>Pending</span>
                <span className="analytics-grade-count">{totalPending}</span>
              </div>
              <div className="analytics-grade-legend-item">
                <span className="analytics-grade-dot analytics-grade-passed" />
                <span>Passed</span>
                <span className="analytics-grade-count">{totalPassed}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  PASS RATE PER DEAR                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <GlassCard className="analytics-chart-card">
          <h2 className="analytics-chart-title">Pass Rate per DEAR</h2>
          <div className="analytics-pass-chart">
            {dearStats.length === 0 ? (
              <div className="analytics-empty">No DEARs yet</div>
            ) : (
              dearStats.map((ds) => {
                const label = ds.dear.week && ds.dear.term ? `${ds.dear.week} —/${ds.dear.term}` : ds.dear.week || ds.dear.id.slice(0, 6);
                const rate = ds.total > 0 ? Math.round((ds.passed / ds.total) * 100) : 0;
                return (
                  <div key={ds.dear.id} className="analytics-pass-row">
                    <span className="analytics-pass-label">{label}</span>
                    <div className="analytics-pass-track">
                      <div
                        className="analytics-pass-fill"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className={`analytics-pass-value ${rate > 0 ? 'analytics-pass-positive' : ''}`}>{rate}%</span>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  TOP PERFORMERS                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <GlassCard className="analytics-chart-card">
          <h2 className="analytics-chart-title">🏆 Top Performers</h2>
          <div className="analytics-performers">
            {performers.length === 0 ? (
              <div className="analytics-empty">No submissions yet</div>
            ) : (
              performers.slice(0, 10).map((perf, i) => (
                <div key={perf.profile.id} className="analytics-performer-row">
                  <span className={`analytics-performer-rank ${i < 3 ? `analytics-rank-${i + 1}` : ''}`}>
                    {i + 1}
                  </span>
                  <Avatar url={perf.profile.avatar_url} name={`${perf.profile.first_name} ${perf.profile.last_name}`} size={36} />
                  <div className="analytics-performer-info">
                    <span className="analytics-performer-name">
                      {perf.profile.first_name} {perf.profile.last_name}
                    </span>
                    <span className="analytics-performer-stat">{perf.passed} passed</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

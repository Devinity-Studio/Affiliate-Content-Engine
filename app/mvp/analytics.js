'use strict';

/**
 * ACE — Result tracking and the analytics dashboard.
 *
 * There is no shop API here, so revenue is never invented: the owner records the
 * numbers from the affiliate report (clicks, orders, commission) against a
 * content id, and this module adds them up. Published content with no recorded
 * result stays at THB 0 and says "ยังไม่บันทึกผล" instead of showing a guess.
 */

const profiles = require('./profiles');

const RESULT_SOURCE = 'MANUAL_ENTRY';

function nowIso() {
  return new Date().toISOString();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function intOrZero(value, field) {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.round(number) !== number) {
    throw httpError(400, `${field} must be a non-negative whole number`);
  }
  return number;
}

function money(value, field) {
  if (value === undefined || value === null || value === '') return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(400, `${field} must be a non-negative amount`);
  return Math.round(number * 100) / 100;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${field} must be a valid ISO date`);
  return date.toISOString();
}

function baseResults() {
  return { results: {}, resultOrder: [] };
}

function recordsFor(state, contentId) {
  return (state.resultOrder || [])
    .map((id) => (state.results || {})[id])
    .filter((record) => record && record.content_id === contentId);
}

/**
 * Adds one result row to a published content item. A content that was never
 * published has no affiliate outcome to report, so it is refused rather than
 * quietly attached to a draft.
 */
function addResult(state, payload = {}) {
  const contentId = String(payload.content_id || '').trim();
  if (!contentId) throw httpError(400, 'content_id is required');
  const project = state.contents ? state.contents[contentId] : null;
  if (!project) throw httpError(404, `content project not found: ${contentId}`);
  const schedule = project.publish_schedule || null;
  if (!schedule || schedule.status !== 'PUBLISHED') {
    throw httpError(409, 'results can only be recorded for content that has been published');
  }
  const clicks = intOrZero(payload.clicks, 'clicks');
  const orders = intOrZero(payload.orders, 'orders');
  if (orders > clicks && clicks > 0) throw httpError(400, 'orders cannot exceed clicks');
  const commission = money(payload.commission_thb, 'commission_thb');
  const profile = profiles.resolveProfile(state, project.profile_id) || profiles.activeProfile(state);
  const record = {
    id: `RES-${(state.resultOrder || []).length + 1}`,
    content_id: contentId,
    profile_id: profile ? profile.id : null,
    platform: project.platform || (profile ? profile.platform : null),
    recorded_at: nowIso(),
    period_start: optionalDate(payload.period_start, 'period_start'),
    period_end: optionalDate(payload.period_end, 'period_end'),
    clicks,
    orders,
    commission_thb: commission,
    note: typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim().slice(0, 300) : null,
    source: RESULT_SOURCE,
    synthetic: true,
  };
  state.results[record.id] = record;
  state.resultOrder.push(record.id);
  return record;
}

function totalsOf(rows) {
  const totals = rows.reduce((acc, row) => ({
    clicks: acc.clicks + row.clicks,
    orders: acc.orders + row.orders,
    commission_thb: Math.round((acc.commission_thb + row.commission_thb) * 100) / 100,
  }), { clicks: 0, orders: 0, commission_thb: 0 });
  totals.conversion_rate = totals.clicks ? Math.round((totals.orders / totals.clicks) * 10000) / 100 : null;
  totals.commission_per_order = totals.orders ? Math.round((totals.commission_thb / totals.orders) * 100) / 100 : null;
  return totals;
}

/**
 * Dashboard read model. Every published content appears once, even without a
 * recorded result, so the gap is visible instead of hidden.
 */
function buildAnalytics(state, options = {}) {
  const filterProfile = options.profile_id ? profiles.resolveProfile(state, options.profile_id) : null;
  const contents = (state.contentOrder || [])
    .map((id) => (state.contents || {})[id])
    .filter(Boolean)
    .filter((project) => !filterProfile || project.profile_id === filterProfile.id);

  const rows = contents
    .filter((project) => project.publish_schedule && project.publish_schedule.status === 'PUBLISHED')
    .map((project) => {
      const records = recordsFor(state, project.content_id);
      const sums = records.reduce((acc, record) => ({
        clicks: acc.clicks + record.clicks,
        orders: acc.orders + record.orders,
        commission_thb: acc.commission_thb + record.commission_thb,
        last: record.recorded_at > acc.last ? record.recorded_at : acc.last,
      }), { clicks: 0, orders: 0, commission_thb: 0, last: '' });
      const profile = profiles.resolveProfile(state, project.profile_id);
      const schedule = project.publish_schedule;
      const offer = project.offer_snapshot || {};
      return {
        content_id: project.content_id,
        candidate_id: project.candidate_id || null,
        title: offer.product_name || project.content_id,
        profile_id: project.profile_id || null,
        profile_name: profile ? profile.name : '(ยังไม่ผูกโปรไฟล์)',
        platform: project.platform || (profile ? profile.platform : schedule.channel),
        channel: schedule.channel,
        published_at: schedule.published_at || null,
        clicks: sums.clicks,
        orders: sums.orders,
        commission_thb: Math.round(sums.commission_thb * 100) / 100,
        conversion_rate: sums.clicks ? Math.round((sums.orders / sums.clicks) * 10000) / 100 : null,
        results_count: records.length,
        last_recorded_at: sums.last || null,
      };
    })
    .sort((a, b) => b.commission_thb - a.commission_thb
      || b.orders - a.orders
      || String(b.published_at || '').localeCompare(String(a.published_at || '')));

  const grouped = (keyName, labelName) => {
    const map = new Map();
    for (const row of rows) {
      const key = row[keyName] || 'UNASSIGNED';
      const current = map.get(key) || {
        key,
        label: row[labelName] || key,
        contents: 0,
        clicks: 0,
        orders: 0,
        commission_thb: 0,
      };
      current.contents += 1;
      current.clicks += row.clicks;
      current.orders += row.orders;
      current.commission_thb += row.commission_thb;
      map.set(key, current);
    }
    return [...map.values()]
      .map((entry) => ({
        ...entry,
        commission_thb: Math.round(entry.commission_thb * 100) / 100,
        conversion_rate: entry.clicks ? Math.round((entry.orders / entry.clicks) * 10000) / 100 : null,
      }))
      .sort((a, b) => b.commission_thb - a.commission_thb);
  };

  const totals = totalsOf(rows);
  return {
    generated_at: nowIso(),
    currency: 'THB',
    filter: { profile_id: filterProfile ? filterProfile.id : null },
    totals: {
      ...totals,
      published: rows.length,
      recorded: rows.filter((row) => row.results_count > 0).length,
      missing_results: rows.filter((row) => row.results_count === 0).length,
      avg_commission_per_content: rows.length
        ? Math.round((totals.commission_thb / rows.length) * 100) / 100
        : 0,
    },
    by_content: rows,
    by_profile: grouped('profile_id', 'profile_name'),
    by_platform: grouped('platform', 'platform'),
    source: {
      kind: RESULT_SOURCE,
      note: 'ตัวเลขรายได้มาจากการบันทึกผลด้วยมือจากรายงาน Affiliate — ระบบไม่ดึงยอดจาก Shopee/Lazada/TikTok เอง',
    },
  };
}

module.exports = {
  RESULT_SOURCE,
  baseResults,
  addResult,
  buildAnalytics,
  recordsFor,
};

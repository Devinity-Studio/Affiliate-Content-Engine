'use strict';

// 07-csv-reconciler.js - Core Reconcile Functions
// อ่านไฟล์ Performance CSV และจับคู่กับรหัสคอนเทนต์

/**
 * อ่านและทำความสะอาดข้อมูล CSV
 * @param {string} rawCSV 
 * @returns {Array}
 */
function parseCSV(rawCSV) {
  const lines = rawCSV.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || 0;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * จับคู่ CSV กับ candidate ในระบบ
 * @param {Array} csvRows 
 * @param {Array} systemCandidates 
 * @returns {Object}
 */
function reconcile(csvRows, systemCandidates) {
  const map = {};
  systemCandidates.forEach(c => {
    const k = c.content_id || c.sub_id || c.id;
    if (k && !map[k]) map[k] = c;
  });
  
  const reconciled = [];
  const unmatchedCSV = [];
  const unmatchedSystem = [];
  
  csvRows.forEach(row => {
    const id = row.content_id || row.sub_id;
    if (map[id]) {
      reconciled.push({ csv: row, candidate: map[id] });
    } else {
      unmatchedCSV.push(row);
    }
  });
  
  systemCandidates.forEach(c => {
    const hasMatch = csvRows.some(r => r.content_id === c.content_id || r.sub_id === c.sub_id);
    if (!hasMatch) unmatchedSystem.push(c);
  });
  
  return { reconciled, unmatchedCSV, unmatchedSystem };
}

/**
 * สรุปผลลัพธ์เป็นรายงาน
 * @param {Object} result 
 * @returns {Object}
 */
function summarize(result) {
  const { reconciled, unmatchedCSV, unmatchedSystem } = result;
  return {
    totalCSV: csvRows ? csvRows.length : 0,
    matched: reconciled.length,
    unmatchedCSV: unmatchedCSV.length,
    unmatchedSystem: unmatchedSystem.length,
    matchRate: csvRows ? Math.round(reconciled.length / csvRows.length * 100) : 0
  };
}

module.exports = { parseCSV, reconcile, summarize };
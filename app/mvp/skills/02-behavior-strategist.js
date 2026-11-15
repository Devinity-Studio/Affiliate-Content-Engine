/**
 * 02-behavior-strategist.js
 * สร้างกลยุทธการนำเสนอ เหตุผล และโอกาสทางการตลาดตาม UX Behavior Guide
 * 
 * ฟังก์ชันหลัก:
 * - สร้างกลยุทธการนำเสนอสินค้าแต่ละรายการ
 * - สรุปเหตุผลที่ผู้ซื้อควรสนใจ
 * - คำนวณโอกาสทางการตลาดและอันดับ
 */

'use strict';

/**
 * สร้างกลยุทธการนำเสนอสำหรับสินค้ารายการหนึ่ง
 * @param {Object} candidate - ข้อมูล candidate ที่เลือกแล้ว
 * @param {Array} allCandidates - อาร์เรย์ของ candidate ทั้งหมด
 * @returns {Object} กลยุทธการนำเสนอที่ครบถ้วน
 */
function generateStrategy(candidate, allCandidates) {
  const { product_name, price_thb, category, confidence, claims } = candidate;
  
  // แยกประเภทลูกค้าตามหมวดหมู่สินค้า
  const CATEGORY_AUDIENCE = {
    Beauty: 'สาวกสกินแคร์เปรียบเทียบเซรั่มและครีมกันแดด',
    Home: 'ผู้จัดการบ้านที่ซื้อของเก็บหรือครัวเรื่อย',
    Electronics: 'ผู้ซื้อไอเสียงบudget เบาที่เปรียบเทียบไมโครโฟนราคาเบา',
    Default: 'ผู้บริโภคที่สนใจสินค้าในประเภทนี้'
  };
  
  const audience = CATEGORY_AUDIENCE[category] || `ผู้บริโภคที่สนใจสินค้าในประเภท ${category || 'ไม่ระบุ'}`;
  
  // สรุปเหตุผลหลัก 3 ข้อ
  const primaryReasons = claims
    .filter(c => c.class !== 'UNKNOWN')
    .slice(0, 3)
    .map(c => c.text.substring(0, 80) + (c.text.length > 80 ? '...' : ''));
  
  // คำนวณโอกาสทางการตลาด
  const opportunityScore = Math.round(
    0.3 * (candidate.confidence || 0) * 100 +
    0.25 * (allCandidates.length > 0 ? allCandidates.length : 1) /
    (allCandidates.length + 1) * 100 +
    0.15 * (price_thb > 0 ? Math.min(price_thb / 1000, 1) * 100 : 50)
  );
  
  // หา candidate อันดับต้น
  const topRank = allCandidates
    .sort((a, b) => b.rank - a.rank)[0];
  
  return {
    candidateId: candidate.id,
    productName: product_name,
    audience: audience,
    primaryReasons: primaryReasons,
    opportunityScore: opportunityScore,
    opportunityLevel: opportunityScore >= 80 ? 'สูง' : opportunityScore >= 60 ? 'ปานกลาง' : 'ต่ำ',
    recommendation: topRank 
      ? `แนะนำอันดับ ${topRank.rank}: ${topRank.title} - ราคา THB ${topRank.price_thb.toFixed(2)}`
      : 'ไม่มีข้อมูลเพียงพอสำหรับการแนะนำ',
    generatedAt: new Date().toISOString(),
    strategyVersion: 'behavior-strategist-v1'
  };
}

/**
 * สร้างรายงานโอกาสทางการตลาดสำหรับทุก candidate
 * @param {Array} candidates - อาร์เรย์ของ candidate ทั้งหมด
 * @returns {Object} รายงานโอกาสทางการตลาด
 */
function generateMarketOpportunityReport(candidates) {
  const total = candidates.length;
  const avgConfidence = total > 0 
    ? Math.round(candidates.reduce((sum, c) => sum + (c.confidence || 0), 0) / total * 100) / 100
    : 0;
  
  const rankDistribution = {};
  for (const c of candidates) {
    const rank = c.rank;
    rankDistribution[rank] = (rankDistribution[rank] || 0) + 1;
  }
  
  const priceRanges = {
    under100: 0,
    '100-500': 0,
    '500-1000': 0,
    over1000: 0
  };
  
  for (const c of candidates) {
    if (c.price_thb < 100) priceRanges.under100++;
    else if (c.price_thb < 500) priceRanges['100-500']++;
    else if (c.price_thb < 1000) priceRanges['500-1000']++;
    else priceRanges.over1000++;
  }
  
  return {
    totalCandidates: total,
    averageConfidence: avgConfidence,
    rankDistribution: rankDistribution,
    priceDistribution: priceRanges,
    marketInsight: avgConfidence > 0.7 
      ? 'ตลาดมีความสนใจสูง สินค้าเหล่านี้มีโอกาสเปิดเผยแพร่ได้รวดเร็ว'
      : avgConfidence > 0.4
        ? 'ตลาดมีความสนใจปานกลาง สินค้าบางรายการน่าสนใจ สามารถพิจารณาเพิ่มได้'
        : 'ตลาดมีความสนใจต่ำ สินค้าที่เลือกอาจต้องปรับปรุงข้อมูลหรือเลือกรายการอื่น',
    generatedAt: new Date().toISOString(),
    reportVersion: 'behavior-strategist-v1'
  };
}

module.exports = {
  generateStrategy,
  generateMarketOpportunityReport
};
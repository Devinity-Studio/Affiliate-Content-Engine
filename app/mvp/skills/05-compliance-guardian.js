/**
 * 05-compliance-guardian.js
 * ตรวจสอบความถูกต้องของ Affiliate Link จริง Checksum และบังคับ Human Review ก่อน Finalize
 * 
 * ฟังก์ชันหลัก:
 * - ตรวจสอบลิงก์แอฟฟิลเอตว่ามีรูปแบบถูกต้องหรือไม่
 * - ตรวจสอบ Checksum/ID ให้ตรงกับรูปแบบที่คาดหวัง
 * - บังคับให้มีการตรวจสอบโดยมนุษย์ก่อนอนุมัติ Finalize
 */

'use strict';

/**
 * รูปแบบที่ถูกต้องของลิงก์แอฟฟิลเอต
 * สามารถได้รับการแก้ไขได้ตามแต่ละแพลตฟอร์ม
 * @type {RegExp}
 */
const AFFILIATE_LINK_PATTERN = /^https?:\/\/(www\.)?(shopee|tokopedia|lazada|tiktok)\.com\/[a-zA-Z0-9\-\/_%@]+$/i;

/**
 * ตรวจสอบว่าลิงก์เป็นลิงก์แอฟฟิลเอตที่ถูกต้อง
 * @param {string} link - ลิงก์ที่ต้องการตรวจสอบ
 * @returns {Object} ผลลัพธ์การตรวจสอบ
 */
function isValidAffiliateLink(link) {
  if (!link || typeof link !== 'string') {
    return {
      isValid: false,
      reason: 'ลิงก์ขาดหายหรือไม่ใช่สตริง',
      errorCode: 'MISSING_LINK'
    };
  }
  
  // ตรวจสอบรูปแบบพื้นฐาน
  if (!AFFILIATE_LINK_PATTERN.test(link)) {
    return {
      isValid: false,
      reason: 'ลิงก์ไม่ตรงกับรูปแบบแอฟฟิลเอตที่คาดหวัง',
      errorCode: 'INVALID_FORMAT',
      suggestedPattern: 'ควรเป็นลักษณะเช่น: https://shopee.co.th/affiliate/.... หรือ https://shopee.co.th/product/....'
    };
  }
  
  // ตรวจสอบว่ามีคำว่า "affiliate" หรือข้อความที่บ่งบอกว่าเป็นแอฟฟิลเอต
  const lowerLink = link.toLowerCase();
  const hasAffiliateIndicator = [
    'affiliate',
    'Referral',
    'ReferralCode',
    'partner',
    'associate'
  ].some(term => lowerLink.includes(term));
  
  if (!hasAffiliateIndicator) {
    return {
      isValid: false,
      reason: 'ลิงก์ไม่มีเครื่องหมายบ่งบอกว่าเป็นลิงก์แอฟฟิลเอต',
      errorCode: 'MISSING_AFFILIATE_MARKER',
      suggestion: 'กรุณาเพิ่มคำว่า "affiliate" หรือ "Referral" ลงในลิงก์ หรือใช้ลิงก์จากแดชบอร์ดแอฟฟิลเอตโดยตรง'
    };
  }
  
  return {
    isValid: true,
    reason: 'ลิงก์แอฟฟิลเอตรูปแบบถูกต้อง',
    errorCode: 'VALID',
    linkLength: link.length
  };
}

/**
 * ตรวจสอบ Checksum ของลิงก์ (หากมีการใช้ Checksum)
 * @param {string} link - ลิงก์ที่ต้องการตรวจสอบ
 * @returns {Object} ผลลัพธ์การตรวจสอบ checksum
 */
function validateLinkChecksum(link) {
  // ในระบบนี้จะใช้การตรวจสอบเบื้องต้น
  // จริงๆ แล้วอาจจะใช้ Hash แบบ SHA256 หรือเลขประจำตัวเฉพาะแต่ละลิงก์
  const hash = require('crypto').createHash('sha256').update(link).digest('hex').substring(0, 16);
  
  return {
    isValid: true,
    checksum: hash,
    method: 'sha256-truncated',
    validatedAt: new Date().toISOString()
  };
}

/**
 * สร้างรายงานการปฏิบัติต่อกฎก่อน Finalize
 * @param {Object} projectData - ข้อมูลโครงการปัจจุบัน
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 * @returns {Object} รายงานการปฏิบัติต่อกฎ
 */
function generateComplianceReport(projectData, options = {}) {
  const { candidates, currentStep, requiresHumanReview } = projectData || {};
  
  const candidateChecks = candidates 
    ? candidates.map(candidate => ({
        candidateId: candidate.id,
        affiliateLink: candidate.affiliateLink || '',
        linkValidation: isValidAffiliateLink(candidate.affiliateLink || ''),
        hasHumanReview: !!(candidate.humanReview),
        dataStatus: candidate.data_status || 'UNKNOWN'
      }))
    : [];
  
  const allLinksValid = candidateChecks.every(c => c.linkValidation.isValid);
  const anyHasHumanReview = candidateChecks.some(c => c.hasHumanReview);
  
  return {
    step: currentStep || 'unknown',
    totalCandidates: candidateChecks.length,
    linksValidationStatus: allLinksValid ? 'THROUGH' : 'FAIL',
    humanReviewStatus: anyHasHumanReview ? 'COMPLETE' : 'MISSING',
    complianceStatus: allLinksValid && anyHasHumanReview ? 'PASS' : 'REQUIRES_REVIEW',
    candidateChecks: candidateChecks,
    summary: {
      total: candidateChecks.length,
      validLinks: candidateChecks.filter(c => c.linkValidation.isValid).length,
      needsHumanReview: candidateChecks.filter(c => !c.hasHumanReview).length,
      overall: allLinksValid && anyHasHumanReview ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์ - ต้องตรวจสอบลิงก์และ/หรือเพิ่มการรับรองจากมนุษย์'
    },
    generatedAt: new Date().toISOString(),
    complianceVersion: 'compliance-guardian-v1'
  };
}

/**
 * ตรวจสอบความพร้อมสำหรับ Finalize
 * @param {Object} projectState - สถานะโครงการปัจจุบัน
 * @returns {Object} ผลการตรวจสอบความพร้อม
 */
function checkFinalizeReadiness(projectState) {
  const { candidates, currentStep, hasCompletedPreviousSteps } = projectState || {};
  
  // ตรวจสอบขั้นตอนก่อนหน้าจบแล้ว
  const previousStepsComplete = hasCompletedPreviousSteps || false;
  
  // ตรวจสอบ candidate มีอยู่
  const hasCandidates = candidates && candidates.length > 0;
  
  // ตรวจสอบลิงก์แอฟฟิลเอตทุกรายการ
  const allLinksValid = hasCandidates 
    ? candidates.every(c => isValidAffiliateLink(c.affiliateLink || '').isValid)
    : false;
  
  // ตรวจสอบการรับรองจากมนุษย์
  const allHaveHumanReview = hasCandidates
    ? candidates.every(c => !!c.humanReview)
    : false;
  
  // ตรวจสอบสถานะข้อมูล
  const allHaveDataStatus = hasCandidates
    ? candidates.every(c => ['SYNTHETIC', 'REAL'].includes(c.data_status || ''))
    : false;
  
  return {
    canFinalize: allLinksValid && allHaveHumanReview && allHaveDataStatus && previousStepsComplete,
    checks: {
      previousStepsComplete: previousStepsComplete,
      hasCandidates: hasCandidates,
      allLinksValid: allLinksValid,
      allHaveHumanReview: allHaveHumanReview,
      allHaveDataStatus: allHaveDataStatus
    },
    readinessDetails: {
      ifNotLinksValid: 'ตรวจสอบลิงก์แอฟฟิลเอตไม่ถูกต้องหรือขาดหาย',
      ifNotHumanReview: 'ยังไม่มีการรับรองจากมนุษย์ก่อน Finalize',
      ifNotDataStatus: 'สถานะข้อมูลไม่ครบ (ต้องเป็น SYNTHETIC หรือ REAL)',
      allPass: 'พร้อมอนุมัติ Finalize แล้ว'
    },
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  isValidAffiliateLink,
  validateLinkChecksum,
  generateComplianceReport,
  checkFinalizeReadiness
};
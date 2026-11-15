/**
 * 04-asset-assembler.js
 * จัดเตรียมไฟล์ภาพ ข้อมูลสินค้า และผูก sub_id
 * 
 * ฟังก์ชันหลัก:
 * - จัดการไฟล์ภาพที่อัปโหลด (Snap, Upload)
 * - ผูกข้อมูลสินค้ากับ candidate
 * - สร้าง sub_id และ metadata สำหรับขั้นตอนถัดไป
 */

'use strict';

/**
 * ประเภทไฟล์ภาพที่รับได้
 * @type {Array<string>}
 */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * ขนาดภาพสูงสุดที่รับได้ (บีบอัดเป็นความกว้าง/สูงสูงสุด)
 * @type {Object}
 */
const MAX_IMAGE_DIMENSIONS = {
  width: 1920,
  height: 1080
};

/**
 * จัดการไฟล์ภาพที่อัปโหลดและสกัดข้อมูลเบื้องต้น
 * @param {File} file - ไฟล์ภาพที่อัปโหลด
 * @param {Object} options - ตัวเลือกการประมวลผล
 * @returns {Promise<Object>} ผลลัพธ์การประมวลผลภาพ
 */
async function processUploadedImage(file, options = {}) {
  return new Promise((resolve, reject) => {
    // ตรวจสอบประเภทไฟล์
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) && !ACCEPTED_IMAGE_TYPES.includes(file.type.split('/')[0])) {
      reject(new Error(`ประเภทไฟล์ ${file.type} ไม่ได้รับอนุญาต กรุณาอัปโหลดเป็น JPEG, PNG, WebP หรือ GIF`));
      return;
    }
    
    // ตรวจสอบขนาดไฟล์ (จำกัด 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`ขนาดไฟล์เกินขีดจำกัด 10MB ปัจจุบัน: ${(file.size / 1024 / 1024).toFixed(2)}MB`));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = () => {
          // บีบอัดภาพเพื่อคืนค่าความกว้าง/สูงที่เหมาะสม
          let width = img.width;
          let height = img.height;
          
          // ปรับขนาดถ้าเกินขีดจำกัด
          if (width > MAX_IMAGE_DIMENSIONS.width) {
            height = (height * MAX_IMAGE_DIMENSIONS.width) / width;
            width = MAX_IMAGE_DIMENSIONS.width;
          }
          if (height > MAX_IMAGE_DIMENSIONS.height) {
            width = (width * MAX_IMAGE_DIMENSIONS.height) / height;
            height = MAX_IMAGE_DIMENSIONS.height;
          }
          
          // สร้าง sub_id สำหรับรูปภาพ
          const timestamp = Date.now();
          const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
          const subId = `IMG-${timestamp}-${randomPart}`;
          
          resolve({
            success: true,
            subId: subId,
            originalName: file.name,
            width: Math.round(width),
            height: Math.round(height),
            sizeKB: Math.round(file.size / 1024),
            mimeType: file.type,
            method: 'asset-assembler',
            processedAt: new Date().toISOString()
          });
        };
        
        img.onerror = (err) => reject(new Error(`ไม่สามารถเปิดไฟล์ภาพได้: ${err.message}`));
        img.src = e.target.result;
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(new Error(`อ่านไฟล์ไม่สำเร็จ: ${err.message}`));
    reader.readAsDataURL(file);
  });
}

/**
 * ผูกข้อมูลสินค้ากับรูปภาพและสร้าง metadata สำหรับ candidate
 * @param {Object} imageInfo - ผลลัพธ์จาก processUploadedImage
 * @param {Object} candidateData - ข้อมูลสินค้าขั้นพื้นฐาน
 * @returns {Object} ข้อมูล candidate ที่สมบูรณ์พร้อม metadata
 */
function assembleCandidateAssets(imageInfo, candidateData) {
  if (!imageInfo || !imageInfo.success) {
    throw new Error('ข้อมูลภาพไม่ถูกต้อง ไม่สามารถประกอบ candidate ได้');
  }
  
  const { subId, width, height, originalName } = imageInfo;
  const {
    product_name,
    price_thb,
    affiliate_link,
    data_status = 'SYNTHETIC',
    candidate_id
  } = candidateData || {};
  
  // สร้าง metadata ครบถ้วน
  const assembled = {
    // ข้อมูลพื้นฐาน
    candidateId: candidate_id || `CND-${subId}`,
    subId: subId,
    productName: product_name || `สินค้าที่${subId.slice(-4)}`,
    priceTHB: price_thb || 0,
    affiliateLink: affiliate_link || '',
    dataStatus: data_status,
    
    // ข้อมูลภาพ
    imageInfo: {
      originalName: originalName,
      width: width,
      height: height,
      sizeKB: imageInfo.sizeKB,
      mimeType: imageInfo.mimeType
    },
    
    // ข้อมูลเวลาและประวัติ
    createdAt: new Date().toISOString(),
    imageUploadedAt: imageInfo.processedAt,
    provenance: {
      source: 'MANUAL_SNAP_ASSEMBLER',
      method: 'ASSET_ASSEMBLER_v1',
      subIdGenerated: subId
    }
  };
  
  return assembled;
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลภาพและสินค้าก่อนบันทึก
 * @param {Object} assembled - ข้อมูลที่ประกอบเสร็จแล้ว
 * @returns {Object} ผลการตรวจสอบ
 */
function validateAssembledData(assembled) {
  const issues = [];
  const warnings = [];
  
  // ตรวจสอบข้อมูลที่จำเป็น
  if (!assembled.candidateId) {
    issues.push('ขาด candidateId ไม่สามารถบันทึกได้');
  }
  
  if (!assembled.productName || assembled.productName.trim().length < 2) {
    issues.push('ชื่อสินค้าขาดหายหรือสั้นเกินไป');
  }
  
  if (assembled.priceTHB === undefined || assembled.priceTHB === null || isNaN(assembled.priceTHB)) {
    issues.push('ราคาไม่ถูกต้องหรือขาดหาย');
  }
  
  if (!assembled.affiliateLink || !affiliate_linkRegex.test(assembled.affiliateLink)) {
    warnings.push('ลิงก์แอฟฟิลเอตอาจไม่ถูกต้องหรือขาดหาย');
  }
  
  // ตรวจสอบขนาดภาพ
  if (assembled.imageInfo) {
    const { width, height } = assembled.imageInfo;
    if (width < 100 || height < 100) {
      warnings.push('ขนาดภาพเล็กเกินไปอาจส่งผลต่อคุณภาพเวลาอัปโหลด');
    }
    if (width > 3840 || height > 3840) {
      warnings.push('ขนาดภาพใหญ่เกินอาจถูกบีบอัดก่อนบันทึก');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues,
    warnings: warnings,
    overallStatus: issues.length > 0 ? 'INVALID' : 'VALID'
  };
}

const affiliate_linkRegex = /^https?:\/\/(www\.)?[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/i;

module.exports = {
  processUploadedImage,
  assembleCandidateAssets,
  validateAssembledData
};
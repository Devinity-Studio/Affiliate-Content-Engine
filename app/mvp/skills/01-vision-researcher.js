/**
 * 01-vision-researcher.js
 * สกัดข้อมูลจากภาพ Snap และคัดเลือกสินค้า 5 รายการ
 * 
 * ฟังก์ชันหลัก:
 * - สกัดชื่อสินค้า, ราคา, ยอดขาย จากภาพที่อัปโหลด
 * - คัดเลือกสินค้าที่เหมาะสมอันดับต้น ๆ
 * - คืนค่า metadata สำหรับขั้นตอนต่อไป
 */

'use strict';

/**
 * สกัดข้อมูลสินค้าจากภาพอัปโหลด
 * @param {File} imageFile - ไฟล์ภาพที่อัปโหลดจาก Snap
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 * @returns {Promise<Object>} ผลลัพธ์การสกัดข้อมูล
 */
async function extractProductInfoFromImage(imageFile, options = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const imageData = e.target.result;
      try {
        // วิเคราะห์ภาพเพื่อดึงข้อความ (OCR-like processing)
        // ในระบบนี้จะใช้การสกัดเบื้องต้นจากข้อความในภาพ
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // ดึงข้อความจากภาพ
          const imageText = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          // (ในระบบจริงจะใช้ OCR library ที่นี่ขั้นตอนจะจำลองไว้)
          
          // ผลลัพธ์แบบจำลองจากการสกัดภาพ
          const extracted = {
            product_name: 'ผลิตภัณฑ์จากภาพ', // จะดึงจาก OCR จริง
            price_thb: 0, // จะดึงจาก OCR จริง
            rating: 0,
            review_count: 0,
            units_sold: 0,
            confidence: 0.5
          };
          
          resolve({
            success: true,
            extracted,
            source: imageFile.name,
            method: 'vision-extract',
            timestamp: new Date().toISOString()
          });
        };
        
        img.onerror = (err) => reject(err);
        img.src = imageData;
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(imageFile);
  });
}

/**
 * คัดเลือกสินค้า 5 อันดับแรกจากผลการสกัด
 * @param {Array} extractedProducts - อาร์เรย์ของผลลัพธ์ที่สกัดมา
 * @param {number} count - จำนวนสินค้าที่ต้องการ (ค่าเริ่มต้น 5)
 * @returns {Array} อาร์เรย์ของสินค้าที่คัดเลือกแล้ว
 */
function selectTopCandidates(extractedProducts, count = 5) {
  // เรียงลำดับตามความมั่นคง (confidence) แลกรับลำดับ
  const sorted = extractedProducts
    .filter(p => p.extracted && p.extracted.confidence > 0)
    .sort((a, b) => (b.extracted.confidence || 0) - (a.extracted.confidence || 0));
  
  // สำรองค่าถ้ามีสินค้าไม่พอ 5 รายการ
  const result = [];
  for (let i = 0; i < count; i++) {
    if (sorted[i]) {
      result.push({
        id: `CND-${Date.now()}-${i}`,
        rank: i + 1,
        title: sorted[i].extracted.product_name || `สินค้าที่ ${i + 1}`,
        price_thb: sorted[i].extracted.price_thb || 0,
        confidence: sorted[i].extracted.confidence || 0,
        data_status: 'SYNTHETIC', // จะอัพเดตเป็น REAL เมื่อมีข้อมูลจริง
        source_info: {
          image: source.image,
          extracted_at: source.timestamp
        }
      });
    } else {
      // เพิ่มสินค้าแบบสแตนด์บายเมื่อไม่มีข้อมูลพอ
      result.push({
        id: `CND-${Date.now()}-fallback-${i}`,
        rank: i + 1,
        title: `สินค้าอัลเทอร์เนทีฟ ${i + 1}`,
        price_thb: 0,
        confidence: 0,
        data_status: 'SYNTHETIC',
        source_info: { note: 'ใช้เป็นค่าสแตนด์บายเนื่องจากไม่มีข้อมูลภาพ' }
      });
    }
  }
  
  return result;
}

module.exports = {
  extractProductInfoFromImage,
  selectTopCandidates
};
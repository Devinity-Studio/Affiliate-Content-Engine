/**
 * 03-thai-scriptwriter.js
 * สร้างบทพูด แคปชันภาษาไทย พร้อม CTA และ Affiliate Disclosure
 * 
 * ฟังก์ชันหลัก:
 * - สร้างบทพูดภาษาไทยจากข้อมูลสินค้า
 * - เพิ่ม CTA (Call-to-Action) ที่เหมาะสม
 * - เพิ่ม Affiliate Disclosure อัตโนมัติ
 */

'use strict';

/**
 * คำคุ้มครองลิขสิทธิ์และคำแจ้งเตือนแอฟฟิลเอตมาตรฐาน
 * @type {Array<string>}
 */
const AFFILIATE_DISCLOSURE_PHRASES = [
  'แอดลิงก์นี้เป็นลิงก์แนะนำสินค้า',
  'โพสต์นี้มีความเกี่ยวข้องกับแอฟฟิลเอต',
  'ลิงก์ผลิตภัณฑ์นี้เป็นลิงก์แอฟฟิลเอต',
  'เราได้รับค่าคอมมิชชันจากการขายผลิตภัณฑ์เหล่านี้'
];

/**
 * คำกระตุ้นการดำเนินการ (CTA) มาตรฐานแบบไทย
 * @type {Array<string>}
 */
const STANDARD_CTAS = [
  'คลิกที่ลิงก์ดูสินค้า',
  'กดเพื่อดูรายละเอียด',
  'เช็คราคาและสั่งซื้อ',
  'ดูโปรโมชันล่าสุด',
  'สั่งซื้อสินค้าตอนนี้'
];

/**
 * สร้างบทพูดภาษาไทยสำหรับสินค้ารายการหนึ่ง
 * @param {Object} candidate - ข้อมูล candidate ที่เลือกแล้ว
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 * @returns {Object} บทพูดและข้อมูลประกอบที่สร้างขึ้น
 */
function createThaiScript(candidate, options = {}) {
  const {
    product_name,
    price_thb,
    list_price_thb,
    rating,
    rating_count,
    commission_per_order_thb,
    promo,
    category
  } = candidate || {};
  
  // สร้างบทพูดเปิด
  const scriptIntro = `สวัสดีครับ/ค่ะ วันนี้เรามาพูดคุยกัน about ${product_name || 'สินค้าที่น่าสนใจ'}`;
  
  // สร้างรายละเอียดสินค้า
  const priceDetails = price_thb !== undefined 
    ? `ราคาเพียง THB ${price_thb.toFixed(2)} ${list_price_thb ? ' (จากราคาเดิม THB ' + list_price_thb.toFixed(2) + ')' : ''}`
    : 'ราคาไม่ระบุ';
  
  // สร้างส่วนของรีวิว
  const reviewSection = rating !== undefined && rating_count !== undefined
    ? `และมีคะแนน ${rating} ด้ามจาก ${rating_count} คนรีวิว`
    : '';
  
  // สร้างส่วนโปรโมชัน
  const promoSection = promo && promo.type
    ? ` มีโปรโมชัน ${promo.type}${promo.label ? ' ' + promo.label : ''}`
    : '';
  
  // สร้าง CTA แบบสุ่มจากรายการมาตรฐาน
  const randomIndex = Math.floor(Math.random() * STANDARD_CTAS.length);
  const selectedCTA = STANDARD_CTAS[randomIndex];
  
  // เลือกคำแจ้งเตือนแอฟฟิลเอตแบบสุ่มหรือใช้ข้อความแรก
  const disclosurePhrase = AFFILIATE_DISCLOSURE_PHRASES[0];
  
  // สร้างบทพูดจบ
  const scriptOutro = `ขอบคุณครับ/ค่ะสำหรับการรับชมตอนนี้`;

  // ประกอบบทพูดเต็มรูปแบบ
  const fullScript = [
    scriptIntro,
    '',
    `ชื่อสินค้า: ${product_name || 'ไม่ระบุ'}`,
    priceDetails,
    reviewSection,
    promoSection,
    '',
    `ข้อความแจ้งเตือน: ${disclosurePhrase}`,
    '',
    selectedCTA
  ].filter(line => line || '').join('\n');

  return {
    script: fullScript,
    productName: product_name,
    priceTHB: price_thb,
    rating: rating,
    reviewCount: rating_count,
    cta: selectedCTA,
    affiliateDisclosure: disclosurePhrase,
    scriptVersion: 'thai-scriptwriter-v1',
    generatedAt: new Date().toISOString(),
    components: {
      intro: scriptIntro,
      productDetails: priceDetails,
      review: reviewSection,
      promotion: promoSection,
      cta: selectedCTA,
      disclosure: disclosurePhrase
    }
  };
}

/**
 * สร้างแคปชันสำหรับโซเชียลมีเดีย (Instagram, TikTok, Facebook)
 * @param {Object} candidate - ข้อมูล candidate
 * @param {string} script - บทพูดที่สร้างขึ้นแล้ว
 * @returns {Object} แคปชันและแฮชแท็กที่แนะนำ
 */
function createSocialCaption(candidate, script) {
  const { product_name, price_thb, category } = candidate || {};
  
  // สกัดคำสำคัญจากบทพูด
  const keywords = script
    .split('\n')
    .filter(line => line.includes('ราคา') || line.includes('ส่วนลด') || line.includes('โปรโมชัน'))
    .join(' | ');
  
  // เลือกแฮชแท็กตามหมวดหมู่
  const CATEGORY_HASHTAGS = {
    Beauty: '#เซรั่ม #ครีมนวด #สกินแคร์ #beautythailand',
    Home: '#บ้านจัดเก็บ #อุปกรณ์บ้าน #homelife #thaihome',
    Electronics: '#ไอเสียง #กะเปราดอิเล็กทรอนิกส์ #gadget #techthailand',
    Default: '#สินค้าแนะนำ #โปรโมชัน #สั่งซื้อ #Thailand'
  };
  
  const hashtags = CATEGORY_HASHTAGS[category] || CATEGORY_HASHTAGS.Default;
  
  // สร้างแคปชัน
  const caption = `
${product_name || 'สินค้าที่น่าสนใจ'} ราคาเพียง THB ${price_thb ? price_thb.toFixed(2) : 'ราคาสุดพิเศษ'} ${promo && promo.label ? ' - ' + promo.label : ''}
${keywords}
${hashtags}
  `.trim();
  
  return {
    caption: caption,
    hashtags: hashtags,
    keywordCount: keywords.split(' | ').filter(k => k.trim()).length,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  createThaiScript,
  createSocialCaption
};
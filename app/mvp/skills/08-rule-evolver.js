'use strict';

// 08-rule-evolver.js - Self Learning & Evolution
// วิเคราะห์ผลลัพธ์จริงและปรับค่าน้ำหนักสำหรับรอบถัดไป

/**
 * วิเคราะห์ผลต่างาระหว่างที่คาดการณ์กับผลจริง
 * @param {Object} prevPredict - การคาดการณ์ก่อนหน้า
 * @param {Object} actualResult - ผลลัพธ์จริงจาก CSV
 * @returns {Object} ข้อมูลสรุปและคำแนะนำ
 */
function analyzeResultDifference(prevPredict, actualResult) {
  const differences = {};
  
  // เปรียบเทียบ clicks
  const clickDiff = (actualResult.clicks || 0) - (prevPredict.clicks || 0);
  differences.clicks = {
    predicted: prevPredict.clicks || 0,
    actual: actualResult.clicks || 0,
    difference: clickDiff,
    percentage: prevPredict.clicks ? Math.round(clickDiff / prevPredict.clicks * 100) : 0
  };
  
  // เปรียบเทียบ orders
  const orderDiff = (actualResult.orders || 0) - (prevPredict.orders || 0);
  differences.orders = {
    predicted: prevPredict.orders || 0,
    actual: actualResult.orders || 0,
    difference: orderDiff,
    percentage: prevPredict.orders ? Math.round(orderDiff / prevPredict.orders * 100) : 0
  };
  
  // เปรียบเทียบ commission
  const commissionDiff = parseFloat(
    (actualResult.commission || 0) - (prevPredict.commission || 0)
  ).toFixed(2);
  differences.commission = {
    predicted: prevPredict.commission || 0,
    actual: actualResult.commission || 0,
    difference: commissionDiff
  };
  
  // คำนวณความแม่นยำรวม
  const accuracy = {};
  if (prevPredict.clicks && actualResult.clicks) {
    accuracy.clicks = Math.round(100 - Math.abs(differences.clicks.percentage));
  }
  if (prevPredict.orders && actualResult.orders) {
    accuracy.orders = Math.round(100 - Math.abs(differences.orders.percentage));
  }
  
  // สร้างคำแนะนำ
  const recommendations = [];
  
  if (Math.abs(differences.clicks.percentage) > 20) {
    recommendations.push('คลิกจำนวนมากเกินไป/น้อยเกินไป - ปรับค่าน้ำหนักความนิยมสินค้า');
  }
  if (Math.abs(differences.orders.percentage) > 20) {
    recommendations.push('ออเดอร์จำนวนมากเกินไป/น้อยเกินไป - ตรวจสอบลิงก์แอฟฟิลเอตและ CTA');
  }
  if (commissionDiff > 0) {
    recommendations.push('ค่าคอมมิชชันเพิ่มขึ้น - สินค้ารายการดีกว่าที่คาดการณ์');
  } else if (commissionDiff < 0) {
    recommendations.push('ค่าคอมมิชชันลดลง - อาจต้องปรับปรุงคุณภาพสินค้าหรือกลยุทธ์');
  }
  
  return {
    differences,
    accuracy,
    recommendations,
    analyzedAt: new Date().toISOString()
  };
}

/**
 * ปรับค่าน้ำหนักสำหรับผู้สกัดภาพรอบถัดไป
 * @param {Object} analysis - ผลลัพธ์จาก analyzeResultDifference
 * @param {number} currentWeights - ค่าน้ำหนักปัจจุบัน (รวมเป็น 100)
 * @returns {Object} ค่าน้ำหนักที่ปรับใหม่
 */
function adjustWeightsForNextRound(analysis, currentWeights = { clicks: 40, orders: 35, commission: 25 }) {
  const newWeights = { ...currentWeights };
  
  // ปรับขึ้นหรือลงตามความแม่นยำ
  if (accuracy.clicks && accuracy.clicks > 80) {
    newWeights.clicks += 5; // คลิกแม่นยำ -> เพิ่มน้ำหนัก
  } else if (accuracy.clicks < 50) {
    newWeights.clicks -= 5; // คลิกไม่แม่นยำ -> ลดน้ำหนัก
  }
  
  if (accuracy.orders && accuracy.orders > 80) {
    newWeights.orders += 5;
  } else if (accuracy.orders && accuracy.orders < 50) {
    newWeights.orders -= 5;
  }
  
  // ปรับค่าคอมมิชชันให้รวมเป็น 100
  const total = newWeights.clicks + newWeights.orders + newWeights.commission;
  newWeights.commission = 100 - newWeights.clicks - newWeights.orders;
  
  return {
    oldWeights: currentWeights,
    newWeights,
    adjustments: {
      clicks: newWeights.clicks - currentWeights.clicks,
      orders: newWeights.orders - currentWeights.orders,
      commission: newWeights.commission - currentWeights.commission
    },
    adjustedAt: new Date().toISOString()
  };
}

/**
 * สร้างรายงานสรุปผลการเรียนรู้เป็นภาษาไทย
 * @param {Object} analysis - ผลลัพธ์จาก analyzeResultDifference
 * @param {Object} weightAdjustment - ผลลัพธ์จาก adjustWeightsForNextRound
 * @returns {Object} รายงานภาษาไทย
 */
function generateLearningReport(analysis, weightAdjustment) {
  const { differences, accuracy } = analysis;
  const { oldWeights, newWeights, adjustments } = weightAdjustment;
  
  const report = {
    title: 'รายงาน Self-Learning & ปรับปรุงเกณฑ์ selection',
    analyzedAt: new Date().toISOString(),
    summaryTH: `
      ความแม่นยำในรอบที่ผ่านมา:
      - คลิก: ${accuracy.clicks}% 
      - ออเดอร์: ${accuracy.orders}% ${accuracy.orders ? '' : '(ไม่มีข้อมูลเพียงพอ)'}
    `,
    detailTH: `
      • **คลิก**: คาดการณ์ ${differences.clicks.predicted} จริง ${differences.clicks.actual} แตกต่าง ${Math.abs(differences.clicks.percentage)}%
      • **ออเดอร์**: คาดการณ์ ${differences.orders.predicted} จริง ${differences.orders.actual} แตกต่าง ${Math.abs(differences.orders.percentage)}%
      • **ค่าคอมมิชชัน**: คาดการณ์ ${differences.commission.predicted} จริง ${differences.commission.actual} ความต่าง ${differences.commission.difference} บาท
    `,
    weightAdjustmentTH: `
      **การปรับค่าน้ำหนัก**:
      - คลิก: จาก ${oldWeights.clicks} → ${newWeights.clicks} (เปลี่ยนแปลง ${adjustments.clicks > 0 ? 'เพิ่ม' : 'ลessen'} ${Math.abs(adjustments.clicks)} จุด)
      - ออเดอร์: จาก ${oldWeights.orders} → ${newWeights.orders} (เปลี่ยนแปลง ${adjustments.orders > 0 ? 'เพิ่ม' : 'ลessen'} ${Math.abs(adjustments.orders)} จุด)
      - ค่าคอมมิชชัน: จาก ${oldWeights.commission} → ${newWeights.commission} (เปลี่ยนแปลง ${adjustments.commission > 0 ? 'เพิ่ม' : 'ลessen'} ${Math.abs(adjustments.commission)} จุด)
    `,
    recommendations: analysis.recommendations,
    nextSteps: [
      'นำค่าน้ำหนักใหม่ไปใช้กับ 01-vision-researcher.js รอบถัดไป',
      'ติดตามผลลัพธ์อีก 2-3 รอบเพื่อยืนยันการปรับปรุง',
      'บันทึกผลการวิเคราะห์ไว้ใน HANDOFF.md เพื่อประวัติศาสตร์'
    ]
  };
  
  return report;
}

module.exports = {
  analyzeResultDifference,
  adjustWeightsForNextRound,
  generateLearningReport
};
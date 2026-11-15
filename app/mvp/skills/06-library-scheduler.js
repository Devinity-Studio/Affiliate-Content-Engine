'use strict';

/**
 * 06-library-scheduler.js
 * เชื่อมต่อ Content Library สำหรับบันทึกงานที่ผลิตเสร็จ
 *
 * สถานะ: ยังไม่ถูกใช้งาน (stub)
 *   - orchestrator ที่เรียกสกิลนี้ยังไม่ถูกผูกกับ route ใด ๆ ใน service.js
 *   - Content Library ในระบบนี้เก็บเฉพาะไฟล์ที่เรนเดอร์จริง (มี sha256 และไฟล์บนดิสก์)
 *     การเขียน entry ที่ไม่มีไฟล์จริงจะทำให้ audit ของ Library รายงาน MISMATCH/MISSING
 *   - จึงยังไม่เขียนข้อมูลลง library จนกว่าจะมีสัญญาว่าจะเก็บอะไรและตรวจ hash อย่างไร
 *
 * ฟังก์ชันนี้ตั้งใจให้ "ล้มเหลวย่างชัดเจน" แทนการสร้างข้อมูลปลอมเงียบ ๆ
 */

function notImplemented(feature) {
  const error = new Error(
    `06-library-scheduler: ${feature} ยังไม่ถูก implement — การบันทึกเข้า Content Library `
    + 'ต้องมีไฟล์จริงและ sha256 ที่ตรวจสอบได้ จึงยังไม่เขียนข้อมูลใด ๆ',
  );
  error.code = 'LIBRARY_SCHEDULER_NOT_IMPLEMENTED';
  return error;
}

async function saveToContentLibrary() {
  throw notImplemented('saveToContentLibrary');
}

module.exports = { saveToContentLibrary };

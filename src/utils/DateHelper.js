// src/utils/DateHelper.js
// 專門處理所有日期運算的工具模組 (精準處理小時計時、跨月份、閏年與 00/24時 轉換)

export class DateHelper {
    static get DAYS() {
        return ['日', '一', '二', '三', '四', '五', '六'];
    }

    /**
     * 取得目前系統時間，並套用「逢 30 分鐘進位 1 小時」邏輯
     * @returns {Object} { dateString: 'YYYY-MM-DD', hour: Number }
     */
    static getCurrentRoundedTime() {
        const now = new Date();
        
        // 分鐘 >= 30，小時自動進位
        if (now.getMinutes() >= 30) {
            now.setHours(now.getHours() + 1);
        }

        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        return {
            dateString: `${yyyy}-${mm}-${dd}`,
            hour: now.getHours()
        };
    }

    /**
     * 根據起始日期 (MFD) 與小時數，精準計算出到期日 (EXD) 與列印所需字串
     * @param {string} mfdDateStr - 起始日期字串 (例如 "2026-07-18")
     * @param {number} mfdHour - 起始小時 (0~23)
     * @param {number} hoursToAdd - 要加上的時效 (小時)
     * @returns {Object} 包含 MFD 與 EXD 排版字串的物件
     */
    static calculateEXD(mfdDateStr, mfdHour, hoursToAdd) {
        // 1. 建立 MFD 基準時間物件
        const mfdDate = new Date(mfdDateStr);
        mfdDate.setHours(mfdHour, 0, 0, 0);

        // 🚨 核心修正：將 MFD 替換為「起:」
        const mY = mfdDate.getFullYear();
        const mM = String(mfdDate.getMonth() + 1).padStart(2, '0');
        const mD = String(mfdDate.getDate()).padStart(2, '0');
        const mDay = this.DAYS[mfdDate.getDay()];
        const mHStr = String(mfdDate.getHours()).padStart(2, '0');
        const mfdPrint = `起: ${mY}.${mM}.${mD} (${mDay}) ${mHStr}時`;

        // 2. 計算 EXD 時間物件
        const exdDate = new Date(mfdDate.getTime());
        // 這裡交給 JS 原生 Date 物件處理跨日/跨月邏輯，絕對安全
        exdDate.setHours(exdDate.getHours() + hoursToAdd);

        let exH = exdDate.getHours();
        let displayDate = new Date(exdDate.getTime());

        // 3. 特殊邏輯轉換：如果計算結果為 00時，則退回前一天的 24時
        if (exH === 0 && hoursToAdd > 0) {
            displayDate.setDate(displayDate.getDate() - 1);
            exH = 24;
        }

        // 🚨 核心修正：將 EXD 替換為「迄:」
        const eY = String(displayDate.getFullYear());
        const eM = String(displayDate.getMonth() + 1).padStart(2, '0');
        const eD = String(displayDate.getDate()).padStart(2, '0');
        const eDay = this.DAYS[displayDate.getDay()];
        const exHStr = String(exH).padStart(2, '0');

        return {
            mfdPrint: mfdPrint,
            exdPrintLine1: `迄: ${eY}.${eM}.${eD} (${eDay})`,
            exdPrintLine2: `${exHStr}時`
        };
    }
}
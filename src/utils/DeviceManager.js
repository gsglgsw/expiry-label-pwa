// src/utils/DeviceManager.js

export default class DeviceManager {
    /**
     * 取得設備的唯一識別碼 (Device ID)
     * 如果是第一次使用，會自動生成一組 UUID 並永久寫入 localStorage
     * 
     * @returns {string} 完整的 UUID
     */
    static getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        
        // 若找不到，代表是全新設備
        if (!deviceId) {
            // 使用瀏覽器原生的加密 API 產生 UUID v4
            deviceId = crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
            console.log(`🔒 [DeviceManager] 新設備初始化，產生 Device ID: ${deviceId}`);
        }
        
        return deviceId;
    }

    /**
     * 取得給門市人員查閱的「設備校驗碼 (前 6 碼)」
     * 轉換為大寫以利肉眼辨識，避免 O/0, I/1 等混淆
     * 
     * @returns {string} 例如: "3B2411"
     */
    static getShortCode() {
        const fullId = this.getDeviceId();
        if (!fullId) return "UNKNOWN";
        // 擷取第一段，並取前 6 個字元轉大寫
        return fullId.split('-')[0].substring(0, 6).toUpperCase();
    }

    /**
     * 取得與 Middleware 溝通用的 API Key
     * 🚨 注意：此 Key 必須與伺服器端的設定完全一致
     * 
     * @returns {string}
     */
    static getApiKey() {
        return "YOUR_SUPER_SECRET_KEY_2026"; 
    }
}
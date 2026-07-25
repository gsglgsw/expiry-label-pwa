// src/utils/DeviceManager.js

export default class DeviceManager {
    /**
     * 取得設備的唯一識別碼 (Device ID)
     * 加入了向下相容的 Fallback 機制，避免舊版瀏覽器或平板無法使用 crypto.randomUUID 導致崩潰
     * 
     * @returns {string} 完整的 UUID
     */
    static getDeviceId() {
        try {
            let deviceId = localStorage.getItem('deviceId');
            
            // 若找不到，代表是全新設備
            if (!deviceId) {
                deviceId = this.generateUUID();
                localStorage.setItem('deviceId', deviceId);
                console.log(`🔒 [DeviceManager] 新設備初始化，產生 Device ID: ${deviceId}`);
            }
            
            return deviceId;
        } catch (error) {
            // 處理極端情況：使用者的瀏覽器(如無痕模式)嚴格阻擋 localStorage 存取
            console.error('🚨 [DeviceManager] 無法存取 localStorage 或生成 UUID:', error);
            // 回傳暫時的 Session ID 以免卡死整個應用程式
            return "TEMP-" + new Date().getTime(); 
        }
    }

    /**
     * 內部方法：產生 UUID v4 (具備高相容性的 Fallback 機制)
     * @returns {string}
     */
    static generateUUID() {
        // 1. 優先使用原生的 crypto.randomUUID (較新瀏覽器且為 HTTPS 支援)
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        
        // 2. Fallback: 使用舊版 crypto.getRandomValues 或 Math.random (支援所有平板與 In-App Browser)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (typeof crypto !== 'undefined' && crypto.getRandomValues)
                ? crypto.getRandomValues(new Uint8Array(1))[0] % 16
                : Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 取得給門市人員查閱的「設備校驗碼 (前 6 碼)」
     * 轉換為大寫以利肉眼辨識，避免 O/0, I/1 等混淆
     * 
     * @returns {string} 例如: "3B2411"
     */
    static getShortCode() {
        const fullId = this.getDeviceId();
        
        // 若發生異常導致產生 TEMP ID，則回傳 UNKNOWN 避免錯誤綁定
        if (!fullId || fullId.startsWith("TEMP-")) {
            return "UNKNOWN";
        }
        
        // 擷取第一段，並取前 6 個字元轉大寫
        return fullId.split('-')[0].substring(0, 6).toUpperCase();
    }

    /**
     * 取得與 Middleware 溝通用的 API Key
     * 🚨 安全警告：由於這是前端程式碼，此 Key 屬於「明文公開」。
     * 僅能作為第一道極弱的防線，請確保內網 Middleware 有針對來源 IP 進行 CORS 或白名單限制。
     * 
     * @returns {string}
     */
    static getApiKey() {
        return "YOUR_SUPER_SECRET_KEY_2026"; 
    }
}
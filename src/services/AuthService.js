// src/services/AuthService.js

export class AuthService {
    /**
     * 呼叫雲端驗證 PIN 碼與設備 ID
     * 🚨 注意：這裡的參數宣告 (apiUrl, pinCode, deviceId) 必須與內部使用的變數完全一致
     */
    static async verifyPin(apiUrl, pinCode, deviceId) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'verifyPin',
                    pin: pinCode,      // 👈 這裡的 pinCode 對應到上方傳入的參數
                    deviceId: deviceId // 🚨 夾帶硬體指紋
                })
            });

            // 處理 HTTP 網路層級的錯誤 (如 404, 500)
            if (!response.ok) {
                throw new Error(`HTTP 錯誤: ${response.status}`);
            }
            
            // 將 GAS 回傳的字串解析為 JSON 物件
            return await response.json();
            
        } catch (error) {
            // 捕捉斷網或伺服器無回應的極端狀況
            console.error('[AuthService] 驗證請求發生錯誤:', error);
            return { success: false, message: '無法連線至認證伺服器，請檢查網路連線' };
        }
    }
}
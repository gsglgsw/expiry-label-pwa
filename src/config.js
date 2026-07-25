// src/config.js

/**
 * 系統全域設定檔 (Environment Configuration)
 */
export const SYS_CONFIG = {
    // ✅ 已更新為剛才除錯完成的最新 GAS Web App 網址
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbwI4C610xoAAwEZnLHoD_PrFooScqq10uxkci_jqFT2zINyGXehDENmlFVtmnqK-iZ1/exec',
    
    // 🛡️ [資安] 區域網路列印通訊密鑰 (集中管理，嚴禁寫死在 Service 內)
    SECURE_API_KEY: 'YOUR_SUPER_SECRET_KEY_2026',
    
    // 預留未來其他環境變數 (例如版本號)
    VERSION: 'v1.0-MVP'
};
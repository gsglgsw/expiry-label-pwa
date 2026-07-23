// src/config.js

/**
 * 系統全域設定檔 (Environment Configuration)
 * ⚠️ 移交系統時，請修改下方的網址為公司帳號重新部署後的 GAS Web App 網址
 */
export const SYS_CONFIG = {
    // 開發環境 / 正式環境的 API Gateway 網址
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzKKDphFI58B_kwt15WJGHHQAGxgaRTZm3xgPkcFYymEAVmV2s3kPaReN_u7OyWYtKV/exec',
    
    // 預留未來其他環境變數 (例如版本號)
    VERSION: 'v1.0-MVP'
};
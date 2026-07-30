// src/app.js
import { SyncManager } from './models/Database.js';
import { UIManager } from './views/UI.js'; 
import { MainController } from './controllers/MainController.js';
import { LoginController } from './controllers/LoginController.js';
import { SYS_CONFIG } from './config.js'; // 👈 確保有正確引入設定檔

const dbManager = new SyncManager();

// src/app.js (節錄)
async function initApp() {
    console.log('🚀 系統啟動中...');

    // 🧹 系統啟動階段：舊版狀態清除
    const deprecatedKeys = ['lanPrinterIp'];
    deprecatedKeys.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`🧹 [System Boot] 已清除舊版廢棄設定: ${key}`);
        }
    });

    localStorage.setItem('apiUrl', SYS_CONFIG.GAS_API_URL);

    try {
        // A：初始化本地資料庫 (IndexedDB)
        await dbManager.initDB();
        
        // 💡 架構師核心升級：Session Persistence (檢查是否已登入)
        const savedStoreId = localStorage.getItem('storeId');
        
        if (savedStoreId) {
            // 🚀 狀況一：本地已有登入憑證，觸發自動登入
            const storeName = localStorage.getItem('storeName');
            console.log(`⚡ 偵測到已登入身分 (${storeName})，觸發自動登入機制...`);
            
            // 🛡️ 架構師防禦性編程：確認節點存在才操作，避免報錯[cite: 11]
            const loginView = document.getElementById('login-view');
            if (loginView) {
                loginView.classList.add('hidden', 'opacity-0', 'pointer-events-none');
            } else {
                console.warn('⚠️ [架構警告] 找不到 #login-view 節點，請確認 index.html 是否正確引入！');
            }
            
            // 直接實例化主系統
            const uiManager = new UIManager();
            const appController = new MainController(dbManager, uiManager);
            
            // 顯示小提示讓店員知道發生什麼事
            uiManager.showToast(`歡迎回來，${storeName} (自動登入)`, 'success');

        } else {
            // 🔒 狀況二：從未登入過，或已經被登出，走正常驗證流程
            console.log('🔒 未偵測到登入憑證，啟動登入控制器...');
            const loginController = new LoginController(SYS_CONFIG.GAS_API_URL, () => {
                console.log('✅ 登入成功，開始初始化 POS 主系統...');
                const uiManager = new UIManager();
                const appController = new MainController(dbManager, uiManager);
            });
        }

    } catch (error) {
        console.error('❌ [系統初始化失敗] 詳細錯誤日誌:', error);
        alert(`系統啟動發生異常，請重新整理網頁。\n\n錯誤代碼: ${error.message}`);
    }

    // 🟢 掛載網路狀態監聽器
    initNetworkListener(); 

    // 🚀 PWA 核心：註冊 Service Worker
   // 假設這在你的 app.js 或是註冊 SW 的檔案中

// src/app.js (Service Worker 註冊與更新機制)

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('✅ [PWA] Service Worker 註冊成功，Scope:', reg.scope);

                // 🌟 新增：每小時 (3600000 毫秒) 在背景靜默檢查一次更新
                setInterval(() => {
                    console.log('🔄 [PWA] 背景輪詢：檢查是否有新版本...');
                    reg.update();
                }, 3600000); 
            })
            .catch(err => {
                console.warn('⚠️ [PWA] Service Worker 註冊失敗:', err);
            });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                console.log('🔄 [系統升級] 偵測到新版本，系統自動重新載入...');
                window.location.reload();
                refreshing = true;
            }
        });
    });
}
}

/**
 * 🟢 網路狀態監聽器 (完美融合 Navbar 原生 UI)
 */
function initNetworkListener() {
    const statusContainer = document.getElementById('network-status');
    if (!statusContainer) return;

    const dot = statusContainer.querySelector('span:first-child');
    const statusText = statusContainer.querySelector('span:last-child');

    const setOffline = () => {
        statusContainer.classList.remove('bg-slate-700');
        statusContainer.classList.add('bg-red-900', 'text-red-200');
        
        dot.classList.remove('bg-green-400', 'animate-pulse');
        dot.classList.add('bg-red-500');
        
        statusText.innerText = '已斷線 (離線)';
    };

    const setOnline = () => {
        statusContainer.classList.remove('bg-red-900', 'text-red-200');
        statusContainer.classList.add('bg-slate-700');
        
        dot.classList.remove('bg-red-500');
        dot.classList.add('bg-green-400', 'animate-pulse');
        
        statusText.innerText = '網路已連線';
    };

    window.addEventListener('offline', setOffline);
    window.addEventListener('online', setOnline);

    if (!navigator.onLine) {
        setOffline();
    }
    
}

// 啟動系統
document.addEventListener('DOMContentLoaded', initApp);
// sw.js (部分替換：最上方的常數與陣列設定)

// 🚨 每次修改專案檔案後，務必手動更改此版本號 (例如 v1 -> v2) 才能觸發更新機制
const CACHE_NAME = 'expiry-label-cache-v20260725-1';

// 🚨 必須將所有在 index.html 載入的資源，以及 JS 內部 import 的檔案全數列入
const FILES_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.ico',
    // 樣式與圖示
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    // 核心 JS 進入點
    '/src/app.js',
    '/src/config.js',
    // Controllers
    '/src/controllers/LoginController.js',
    '/src/controllers/MainController.js',
    // Models
    '/src/models/Database.js',
    // Services (本次補齊)
    '/src/services/AuthService.js',
    '/src/services/PrintService.js',
    // Utils (本次補齊)
    '/src/utils/DateHelper.js',
    '/src/utils/DeviceManager.js',
    '/src/utils/Scanner.js',
    // Views
    '/src/views/UI.js'
];

// 1. 安裝階段 (Install)
self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] 正在安裝新版本...');
    
    // 🌟 核心魔法 1：強制跳過等待階段，立刻進入啟用狀態
    self.skipWaiting(); 
    
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] 預先快取離線檔案');
            return cache.addAll(FILES_TO_CACHE);
        })
    );
});

// 2. 啟用階段 (Activate)
self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] 新版本已啟用，準備接管系統...');
    
    evt.waitUntil(
        // 🌟 核心魔法 2：立刻控制所有目前打開的瀏覽器客戶端
        self.clients.claim().then(() => {
            // 清理舊版本的快取垃圾
            return caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[ServiceWorker] 刪除舊快取:', key);
                        return caches.delete(key);
                    }
                }));
            });
        })
    );
});

// 🟢 階段 3：網路請求攔截器 (Cache-First 策略)
self.addEventListener('fetch', (event) => {
    // 🚨 絕對不快取 GAS 的 API 請求，否則資料庫會無法同步！
    if (event.request.url.includes('script.google.com')) {
        return; 
    }

    // 離線優先邏輯：先找快取，找不到才去網路抓
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // 命中快取，0.1 秒極速回傳
            }
            return fetch(event.request); // 沒中快取，正常發送網路請求
        }).catch(() => {
            console.error('❌ [Service Worker] 離線狀態且無快取檔案:', event.request.url);
            
            // 💡 架構師修復：偽造一個標準的 Response 物件還給瀏覽器，避免 Uncaught TypeError
            return new Response(
                JSON.stringify({ success: false, message: '系統處於離線狀態，請求已被攔截' }), 
                { 
                    status: 503, 
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        })
    );
});
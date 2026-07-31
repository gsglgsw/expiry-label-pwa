// sw.js (Production-Ready 彈性快取架構)

// 🚨 已更新版本號以強制觸發瀏覽器更新
const CACHE_NAME = 'expiry-label-cache-v20260731-5';

// 🚨 架構師修正：全部改為相對路徑 './'，完美適應 GitHub Pages 子目錄
const FILES_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './src/app.js',
    './src/config.js',
    './src/controllers/LoginController.js',
    './src/controllers/MainController.js',
    './src/models/Database.js',
    './src/services/AuthService.js',
    './src/services/PrintService.js',
    './src/utils/DateHelper.js',
    './src/utils/DeviceManager.js',
    './src/utils/Scanner.js',
    './src/views/UI.js'
];

// 1. 安裝階段 (Install) - 導入彈性快取
self.addEventListener('install', (evt) => {
    console.log('[ServiceWorker] 正在安裝新版本...');
    
    // 強制跳過等待階段，立刻進入啟用狀態
    self.skipWaiting(); 
    
    evt.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[ServiceWorker] 開始逐一快取離線檔案...');
            
            // 🌟 架構師核心升級：放棄脆弱的 cache.addAll，改用迴圈逐一抓取
            for (const asset of FILES_TO_CACHE) {
                try {
                    await cache.add(asset);
                } catch (error) {
                    // 🛡️ 防禦性編程：即便單一檔案 404，也只發出警告，絕不中斷整體安裝流程
                    console.warn(`⚠️ [Service Worker] 無法快取資源 (略過): ${asset}`, error.message);
                }
            }
        })
    );
});

// 2. 啟用階段 (Activate) - 清理舊快取
self.addEventListener('activate', (evt) => {
    console.log('[ServiceWorker] 新版本已啟用，準備接管系統...');
    
    evt.waitUntil(
        // 立刻控制所有目前打開的瀏覽器客戶端
        self.clients.claim().then(() => {
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

// 3. 網路請求攔截器 (Cache-First 策略)
self.addEventListener('fetch', (event) => {
    // 絕對不快取 GAS 的 API 請求
    if (event.request.url.includes('script.google.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // 命中快取
            }
            return fetch(event.request); // 沒中快取，發送網路請求
        }).catch(() => {
            console.error('❌ [Service Worker] 離線狀態且無快取檔案:', event.request.url);
            
            // 偽造一個標準的 Response 物件還給瀏覽器，避免 Uncaught TypeError
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
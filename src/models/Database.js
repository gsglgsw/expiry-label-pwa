// 前端離線資料庫管理模組 (src/models/Database.js)
// 示範：在 Database.js 的資料處理階段加入此邏輯 (100% 完整擴充函數)

/**
 * 處理多重品牌的資料展開
 * 嚴守 MVC 原則：將資料清理限制在 Model 層，確保 Controller 拿到的是純淨的單一品牌物件
 * @param {Array<Object>} rawItems - 從 GAS 取得的原始資料陣列
 * @returns {Array<Object>} - 展開後的乾淨資料陣列
 */
function expandMultiBrandItems(rawItems) {
    const expandedItems = [];
    
    rawItems.forEach(item => {
        // 假設你的表單品牌欄位是用半形或全形逗號分隔
        if (item.brandName && (item.brandName.includes(',') || item.brandName.includes('，'))) {
            // 將字串分割，並清除前後多餘空白
            const brands = item.brandName.split(/[,，]/).map(b => b.trim());
            
            brands.forEach(brand => {
                // 使用 ES6 展開運算子進行淺拷貝，並覆寫 brandName 為單一品牌
                expandedItems.push({
                    ...item,
                    brandName: brand
                });
            });
        } else {
            // 若只有單一品牌，直接推入陣列
            expandedItems.push(item);
        }
    });
    
    return expandedItems;
}

// 👉 實作指引：在 Database.js 的 syncFromCloud 方法中，
// 取得 response.json() 之後，先將資料丟進 expandMultiBrandItems 處理，再存入 IndexedDB。

export class SyncManager {
    constructor() {
        this.dbName = 'KitchenExpiryDB';
        this.storeName = 'ingredients';
        this.db = null;
    }

    /**
     * 初始化 IndexedDB
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            // 💡 關鍵修復 1：提升版本號 (Version Bump)
            // 將這裡的數字改為比你原本更大的數字 (例如原本是 1，就改成 2)
            // 每次改動結構，這個數字就必須 +1，才能觸發 onupgradeneeded
            const dbVersion = 2; 
            const request = indexedDB.open(this.dbName || 'PosLabelDB', dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 💡 關鍵修復 2：如果有舊的表，必須先刪除才能重建新結構
                if (db.objectStoreNames.contains(this.storeName)) {
                    db.deleteObjectStore(this.storeName);
                    console.log('🗑️ [Database] 發現舊版資料表，已移除');
                }
                
                // 💡 關鍵修復 3：建立新表，並明確指定新的主鍵為我們剛產生的 UUID ('id')
                db.createObjectStore(this.storeName, { keyPath: 'id' });
                console.log('🏗️ [Database] 建立新版資料表成功，主鍵設為 id');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log(`✅ [Database] 連線成功 (Version: ${dbVersion})`);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('❌ [Database] 連線失敗:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 🚀 升級版：從雲端同步該品牌的專屬資料 (POST 請求)
     */
    async syncFromCloud(apiUrl) {
        try {
            // 1. 取得登入時發放的品牌授權碼
            const brandName = localStorage.getItem('brandName');
            if (!brandName) throw new Error("缺少品牌授權憑證，請重新整理網頁並重新登入！");

            console.log(`[Database] 開始同步 ${brandName} 的專屬資料庫...`);

            // 2. 發送 POST 請求
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'syncData',
                    brandName: brandName
                })
            });

            if (!response.ok) throw new Error(`伺服器連線異常，狀態碼: ${response.status}`);

            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            // 🚨 核心修復：在寫入 IndexedDB 之前，呼叫頂部的展開函式清洗資料
            const rawItems = result.data;
            const items = expandMultiBrandItems(rawItems);
            
            // 💡 證據除錯點：印出清洗後的資料，確認是否有成功拆解出該門市的項目
            console.log(`[Database] 資料展開完成，準備寫入 ${items.length} 筆資料`, items);

            // 3. 清空舊資料並寫入 IndexedDB
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            store.clear(); // 徹底清空舊有資料，避免品牌殘留
            items.forEach(item => store.put(item));

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.log(`✅ [Database] 同步完成`);
                    resolve(true); 
                };
                tx.onerror = () => reject(tx.error);
            });

        } catch (error) {
            console.error('❌ [Database] 同步失敗:', error);
            return false;
        }
    }

    /**
     * 3. 員工掃描二維碼或手動輸入後，查詢資料 (支援雙欄位搜尋)
     * @param {string} keyword - 掃描槍讀取到的條碼，或員工手動輸入的內部編號
     */
    async findIngredient(keyword) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            // 使用 getAll() 把目前所有食材規則一次抓出來
            const request = store.getAll();

            request.onsuccess = () => {
                const allItems = request.result;
                
                // 在所有資料中，尋找「二維碼 (barcodeId)」或「內部編號 (internalId)」相符的資料
                const foundItem = allItems.find(item => {
                    // 為了防止大小寫輸入錯誤，比對時統一轉成大寫
                    const targetBarcode = String(item.barcodeId).toUpperCase();
                    const targetInternal = String(item.internalId).toUpperCase();
                    const searchKey = String(keyword).toUpperCase();

                    return targetBarcode === searchKey || targetInternal === searchKey;
                });

                resolve(foundItem); // 找到會回傳該物件，找不到會回傳 undefined
            };
            
            request.onerror = () => {
                console.error('資料庫查詢錯誤:', request.error);
                reject(request.error);
            };
        });
    }
    /**
     * 獲取本地資料庫中的所有食材資料
     * @returns {Promise<Array>} 所有資料的陣列
     */
    async getAllItems() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll(); // IndexedDB 原生方法，獲取全部資料

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject('讀取全部資料失敗: ' + request.error);
        });
    }
    
}

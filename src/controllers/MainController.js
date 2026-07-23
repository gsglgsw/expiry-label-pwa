// src/controllers/MainController.js

import { printService } from '../services/PrintService.js';
import { DateHelper } from '../utils/DateHelper.js';

export class MainController {
    constructor(dbManager, uiManager) {
        this.db = dbManager;
        this.ui = uiManager;
        
        this.allItems = [];         
        this.currentCategory = '全部商品'; 
        this.selectedItem = null;   

        this.handleCategorySelect = this.handleCategorySelect.bind(this);
        this.handleItemSelect = this.handleItemSelect.bind(this);
        this.handlePrintAction = this.handlePrintAction.bind(this);
        this.handleSearch = this.handleSearch.bind(this); // ✅ 現已擁有對應的實作方法
        this.recalculateEXD = this.recalculateEXD.bind(this);
        this.handleSyncAction = this.handleSyncAction.bind(this);
        this.handleCategoryChange = this.handleCategoryChange.bind(this);

        this.bindStaticEvents();
        this.initController();
        this.initEventListeners();
    }

    initEventListeners() {
        console.log('🔗 [MainController] 正在綁定事件監聽器...');
        const btnLogout = document.getElementById('btn-logout');
        
        if (btnLogout) {
            console.log('✅ [MainController] 成功找到登出按鈕，執行綁定。');
            btnLogout.addEventListener('click', () => {
                if (confirm('確定要登出並切換門市嗎？\n⚠️ 注意：若目前處於斷網狀態，登出後將無法再次登入！')) {
                    const keysToRemove = ['storeId', 'storeName', 'brandName', 'middlewareIp', 'printerIp'];
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    window.location.reload(); 
                }
            });
        } else {
            console.error('❌ [MainController] 找不到 id 為 btn-logout 的按鈕！');
        }
    }

    bindStaticEvents() {
        const syncBtn = document.getElementById('sync-btn');
        if (syncBtn) syncBtn.addEventListener('click', this.handleSyncAction);

        this.ui.searchInput.addEventListener('input', this.handleSearch);
        
        this.ui.searchInput.addEventListener('focus', () => {
            if (this.currentCategory !== '全部商品') {
                this.handleCategorySelect('全部商品');
            }
        });

        this.ui.previewMfdInput.addEventListener('change', this.recalculateEXD);
        
        const hourDisplay = document.getElementById('preview-mfd-hour-display');
        if (hourDisplay) {
            hourDisplay.addEventListener('hourChanged', this.recalculateEXD);
        }

        this.ui.categorySelect.addEventListener('change', this.handleCategoryChange);
        this.ui.customCategoryInput.addEventListener('input', this.recalculateEXD);
        this.ui.customDaysInput.addEventListener('input', this.recalculateEXD);
        
        this.ui.btnPrint.addEventListener('click', this.handlePrintAction);
    }
    
    // ✅ 補齊遺失的方法：處理搜尋過濾邏輯，並確保空白標籤依然置頂
    handleSearch(event) {
        const keyword = String(event.target.value).toLowerCase().trim();
        
        if (this.currentCategory !== '全部商品') {
            this.currentCategory = '全部商品';
            this.ui.updateActiveCategoryUI('全部商品');
        }

        let filteredItems = this.allItems.filter(item => {
            const label = String(item.labelName || '').toLowerCase();
            const id = String(item.internalId || '').toLowerCase();
            return label.includes(keyword) || id.includes(keyword) || id === 'sys-blank';
        });

        // 📌 維持 SYS-BLANK 絕對置頂
        const blankItemIndex = filteredItems.findIndex(item => String(item.internalId || '').toUpperCase() === 'SYS-BLANK');
        if (blankItemIndex > 0) {
            const blankItem = filteredItems.splice(blankItemIndex, 1)[0];
            filteredItems.unshift(blankItem); 
        }

        this.ui.renderItemGrid(filteredItems, this.handleItemSelect);
    }

    async initController() {
        try {
            const localItems = await this.db.getAllItems();
            if (localItems && localItems.length > 0) {
                this.applyDataToView(localItems); 
                if (navigator.onLine) this.backgroundSync(); 
            } else {
                if (!navigator.onLine) throw new Error('首次登入必須具備網路連線來下載商品檔！請恢復網路。');
                this.ui.showLoading('首次載入，正在從雲端下載商品資料...');
                await this.backgroundSync(); 
                this.ui.hideLoading();
            }
        } catch (error) {
            console.error('❌ [系統初始化失敗] 詳細錯誤日誌:', error);
            this.ui.showToast(`啟動異常: ${error.message}`, 'error');
            this.ui.hideLoading(); 
        }
    }

    applyDataToView(rawItems) {
        this.allItems = rawItems.sort((a, b) => {
            const sortA = a.catSort !== undefined ? a.catSort : 999;
            const sortB = b.catSort !== undefined ? b.catSort : 999;
            if (sortA !== sortB) return sortA - sortB; 
            
            const itemSortA = a.itemSort !== undefined ? a.itemSort : 999;
            const itemSortB = b.itemSort !== undefined ? b.itemSort : 999;
            return itemSortA - itemSortB;
        });

        const categories = this.extractUniqueCategories(this.allItems);
        this.ui.renderCategoryMenu(categories, this.handleCategorySelect);
        this.handleCategorySelect('全部商品'); 
    }

    async backgroundSync() {
        try {
            const apiUrl = localStorage.getItem('apiUrl'); 
            if (!apiUrl) return;
            const isSuccess = await this.db.syncFromCloud(apiUrl);
            if (isSuccess) {
                const updatedItems = await this.db.getAllItems();
                this.applyDataToView(updatedItems);
            }
        } catch (error) {
            console.error('❌ [SWR] 背景同步失敗:', error);
        }
    }

    handleCategorySelect(categoryName) {
        this.currentCategory = categoryName;
        this.ui.updateActiveCategoryUI(categoryName);
        this.ui.resetToEmptyState(); 
        this.selectedItem = null;

        let filteredItems = [];
        
        if (categoryName === '全部商品') {
            filteredItems = this.allItems;
        } else {
            filteredItems = this.allItems.filter(item => {
                const safeInternalId = String(item.internalId || '').trim().toUpperCase();
                return item.mainCategory === categoryName || safeInternalId === 'SYS-BLANK';
            });
        }

        const blankItemIndex = filteredItems.findIndex(item => String(item.internalId || '').trim().toUpperCase() === 'SYS-BLANK');
        if (blankItemIndex > 0) {
            const blankItem = filteredItems.splice(blankItemIndex, 1)[0];
            filteredItems.unshift(blankItem); 
        }

        this.ui.renderItemGrid(filteredItems, this.handleItemSelect);
    }

    handleItemSelect(item) {
        
        
        if (!(this instanceof MainController)) {
            console.error('❌ [嚴重架構錯誤] this 作用域遺失！目前的 this 已經不是 MainController。');
        }

        this.selectedItem = item;
        
        this.ui.showPrintPanel(item);
        this.ui.categorySelect.innerHTML = ''; 
        
        if (item && item.category1) {
            this.ui.categorySelect.add(new Option(`${item.category1} (${item.expireHours1 || 0}H)`, 'cat1'));
        }
        if (item && item.category2) {
            this.ui.categorySelect.add(new Option(`${item.category2} (${item.expireHours2 || 0}H)`, 'cat2'));
        }
        this.ui.categorySelect.add(new Option('自訂用途(預設3餐期)', 'custom'));
        
        
        this.handleCategoryChange({ target: this.ui.categorySelect });
    }

    // ✅ 架構優化：修復 MVC 介面對接錯誤，改用正確的 toggleCustomCategoryUI
    handleCategoryChange(event) {
        
        
        if (!this.selectedItem) {
            console.error('❌ [執行攔截] 試圖在 this.selectedItem 為 undefined 的狀態下變更分類！已強制中斷執行以保護系統。');
            return; 
        }

        const selectedVal = event.target.value;
        const hourDisplay = document.getElementById('preview-mfd-hour-display');
        
        if (selectedVal === 'custom') {
            // 對接正確的 UI 方法：開啟自訂面板
            if (typeof this.ui.toggleCustomCategoryUI === 'function') {
                this.ui.toggleCustomCategoryUI(true);
            }
            if (hourDisplay) {
                hourDisplay.dataset.hour = '0';
                hourDisplay.innerText = '00';
            }
        } else {
            // 對接正確的 UI 方法：關閉自訂面板
            if (typeof this.ui.toggleCustomCategoryUI === 'function') {
                this.ui.toggleCustomCategoryUI(false);
            }
            const sysTime = DateHelper.getCurrentRoundedTime();
            if (hourDisplay) {
                hourDisplay.dataset.hour = sysTime.hour;
                hourDisplay.innerText = String(sysTime.hour).padStart(2, '0');
            }
            this.ui.previewMfdInput.value = sysTime.dateString;
        }

        this.recalculateEXD();
    }

    recalculateEXD() {
        if (!this.selectedItem) return;
        
        let mfdStr = this.ui.previewMfdInput.value;
        const hourDisplay = document.getElementById('preview-mfd-hour-display');
        let mfdHour = 0;
        
        if (!mfdStr) {
            const defaultTime = DateHelper.getCurrentRoundedTime();
            mfdStr = defaultTime.dateString;
            mfdHour = defaultTime.hour;
            
            this.ui.previewMfdInput.value = mfdStr;
            if (hourDisplay) {
                hourDisplay.dataset.hour = mfdHour;
                hourDisplay.innerText = String(mfdHour).padStart(2, '0');
            }
        } else {
            mfdHour = parseInt(hourDisplay ? (hourDisplay.dataset.hour || '0') : '0', 10);
        }

        const selectedVal = this.ui.categorySelect.value;
        let hoursToAdd = 0;

        if (selectedVal === 'custom') {
            this.ui.toggleCustomCategoryUI(true); 
            hoursToAdd = parseInt(this.ui.customDaysInput.value, 10) || 36; 
        } else {
            this.ui.toggleCustomCategoryUI(false); 
            // 🚨 終極修復：抓取數值型態的 expireHours1 與 expireHours2，而非文字型態的 category1/2
            if (selectedVal === 'cat1') {
                hoursToAdd = parseInt(this.selectedItem.expireHours1, 10) || 0;
            } else if (selectedVal === 'cat2') {
                hoursToAdd = parseInt(this.selectedItem.expireHours2, 10) || 0;
            }
        }

        const { mfdPrint, exdPrintLine1, exdPrintLine2 } = DateHelper.calculateEXD(mfdStr, mfdHour, hoursToAdd);
        
        let categoryText = (selectedVal === 'custom') 
            ? (this.ui.customCategoryInput.value.trim() || '自訂用途')
            : this.selectedItem[`category${selectedVal === 'cat1' ? '1' : '2'}`];

        const isBlank = (categoryText === '空白');
        
        this.ui.previewMfdDisplay.innerText = mfdPrint;
        this.ui.previewCategoryText.innerText = isBlank ? '' : categoryText;
        
        if (isBlank) {
            this.ui.previewExdText.innerHTML = `EXD: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;時`;
        } else {
            this.ui.previewExdText.innerHTML = `${exdPrintLine1}<br>${exdPrintLine2}`;
        }
        
        this.currentPrintData = {
            mfdPrint: mfdPrint,
            category: isBlank ? '' : `用途: ${categoryText}`,
            exdLine1: isBlank ? 'EXD:        .       .       ' : exdPrintLine1,
            exdLine2: isBlank ? '                       時' : exdPrintLine2
        };
    }

    // ✅ 架構優化：移除重複的 generateLabelTSPL，保留最新的 4x5cm 0 度旋轉重構版
    generateLabelTSPL(printData, qty) {
        return `
SIZE 40 mm, 50 mm
GAP 2 mm, 0
CLS
TEXT 10,20,"TST24.BF2",0,1,1,"員工: ${printData.empName}"
TEXT 10,60,"TST24.BF2",0,1,1,"${printData.mfdPrint}"
TEXT 10,130,"TST24.BF2",0,2,2,"${printData.itemName}"
TEXT 220,150,"TST24.BF2",0,1,1,"${printData.category}"
TEXT 30,240,"TST24.BF2",0,1,1,"${printData.exdLine1}"
TEXT 130,290,"TST24.BF2",0,1,1,"${printData.exdLine2}"
PRINT 1,${qty}
        `.trim();
    }

    async handlePrintAction() {
        if (!this.selectedItem || !this.currentPrintData) return;
        
        const btn = this.ui.btnPrint;
        const originalText = btn.innerHTML;
        const qty = parseInt(this.ui.qtyInput.value, 10) || 1;
        
        // 統一從環境變數提取設定
        const targetIp = localStorage.getItem('middlewareIp'); 
        const printerIp = localStorage.getItem('printerIp');
        const lang = localStorage.getItem('printerLang') || 'TSPL'; 
        
        if (!targetIp || !printerIp) {
            this.ui.showToast('尚未設定中介電腦或印表機 IP。', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = `⏳ 傳輸中 (${lang})...`;
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            const printData = {
                empName: this.ui.employeeNameInput.value || '未填寫',
                itemName: this.selectedItem.labelName,
                ...this.currentPrintData
            };
            
            // 步驟 1: 委託 Service 根據語言產出指令
            const finalCommand = printService.generateCommand(lang, printData, qty);

            // 步驟 2: 委託 Service 發送至中介層
            await printService.sendPrintJob(targetIp, printerIp, finalCommand);
            
            this.ui.showToast(`✅ ${lang} 列印指令已成功送達！`);
        } catch (error) {
            this.ui.showToast(`列印失敗: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    extractUniqueCategories(items) {
        const catSet = new Set();
        items.forEach(item => {
            if (item.mainCategory && item.mainCategory.trim() !== '') {
                catSet.add(item.mainCategory.trim());
            }
        });
        return Array.from(catSet);
    }

    async handleSyncAction(event) {
        this.ui.showLoading('🔄 從雲端同步資料中，請稍候...');
        try {
            const apiUrl = localStorage.getItem('apiUrl'); 
            if (!apiUrl) throw new Error("尚未設定雲端資料庫網址");
            const isSuccess = await this.db.syncFromCloud(apiUrl);
            if (isSuccess) {
                await this.initController();
                this.ui.showToast('資料同步成功！');
            }
        } catch (error) {
            this.ui.showToast(`系統錯誤: ${error.message}`, 'error');
        } finally {
            this.ui.hideLoading();
        }
    }
}
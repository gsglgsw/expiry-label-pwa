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
        this.handleSearch = this.handleSearch.bind(this); 
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
                    const keysToRemove = ['storeId', 'storeName', 'brandName', 'middlewareIp', 'printerIp', 'printerLang', 'apiUrl'];
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
        
        // 🚨 架構師修正：已拔除 customCategoryInput 相關的監聽器綁定
        
        this.ui.btnPrint.addEventListener('click', this.handlePrintAction);
    // 🚨 更新：自訂標籤文字的即時雙向綁定 (加入防禦性長度計算)
        const customInput = document.getElementById('custom-label-input');
        const customPreview = document.getElementById('preview-custom-text');
        
        if (customInput && customPreview) {
            customInput.addEventListener('input', (event) => {
                const val = event.target.value.trim();
                
                // 🛡️ 架構師防呆：使用 Regex 剔除所有換行符號 (\n) 後，再來計算「純文字長度」
                const visibleLength = val.replace(/\n/g, '').length;

                if (val === '') {
                    customPreview.className = "text-3xl font-black text-gray-400 text-center whitespace-pre-wrap break-all leading-snug w-full";
                    customPreview.innerText = '請在右側輸入\n自訂標籤內容';
                } else if (visibleLength <= 8) {
                    // 1~8 個可視字元 (就算中間夾了 \n，只要字數不超過8，一樣維持最大字體)
                    customPreview.className = "text-[3.5rem] font-black text-gray-800 text-center whitespace-pre-wrap break-all leading-tight w-full tracking-wide";
                    customPreview.innerText = val;
                } else if (visibleLength <= 16) {
                    // 9~16 個可視字元
                    customPreview.className = "text-4xl font-black text-gray-800 text-center whitespace-pre-wrap break-all leading-snug w-full tracking-wide";
                    customPreview.innerText = val;
                } else {
                    // 17 個字以上
                    customPreview.className = "text-2xl font-black text-gray-800 text-center whitespace-pre-wrap break-all leading-snug w-full";
                    customPreview.innerText = val;
                }
            });
        }
    }
    
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
        
        // 🚨 判斷是否為自訂/空白標籤
        const isCustomLabel = (item.internalId === 'SYS-BLANK' || item.internalId === 'SYS-CUSTOM');
        
        // 抓取所有需要的 DOM 元素
        const customContainer = document.getElementById('custom-label-container');
        const categoryContainer = document.getElementById('category-select-container');
        const normalLayout = document.getElementById('preview-normal-layout');
        const customLayout = document.getElementById('preview-custom-layout');
        const customInput = document.getElementById('custom-label-input');
        const customPreview = document.getElementById('preview-custom-text');
        const empContainer = document.getElementById('employee-input-container'); 

        if (isCustomLabel) {
            // 切換為自訂模式 UI 與圖層
            if (customContainer) customContainer.classList.remove('hidden');
            if (categoryContainer) categoryContainer.classList.add('hidden');
            if (normalLayout) normalLayout.classList.add('hidden');
            if (customLayout) customLayout.classList.remove('hidden');
            
            // 隱藏員工輸入框
            if (empContainer) empContainer.classList.add('hidden');
            
            // 重置自訂標籤的預設文字與樣式
            if (customInput) customInput.value = '';
            if (customPreview) {
                customPreview.className = "text-3xl font-black text-gray-400 text-center whitespace-pre-wrap break-all leading-snug w-full";
                customPreview.innerText = '請在右側輸入\n自訂標籤內容';
            }
        } else {
            // 恢復為一般效期模式 UI 與圖層
            if (customContainer) customContainer.classList.add('hidden');
            if (categoryContainer) categoryContainer.classList.remove('hidden');
            if (normalLayout) normalLayout.classList.remove('hidden');
            if (customLayout) customLayout.classList.add('hidden');
            
            // 顯示員工輸入框
            if (empContainer) empContainer.classList.remove('hidden');
            
            // 🚨 恢復下拉選單：注入資料庫分類與手寫選項
            if (item.category1) this.ui.categorySelect.add(new Option(`${item.category1} (${item.expireHours1 || 0}H)`, 'cat1'));
            if (item.category2) this.ui.categorySelect.add(new Option(`${item.category2} (${item.expireHours2 || 0}H)`, 'cat2'));
            
            // 🔧 架構師修復：補回遺失的「手寫標籤」常駐選項
            this.ui.categorySelect.add(new Option('手寫標籤', 'custom'));
        }
        
        // 觸發重新計算，把資料填入畫面
        this.handleCategoryChange({ target: this.ui.categorySelect });
    }

    handleCategoryChange(event) {
        if (!this.selectedItem) {
            console.error('❌ [執行攔截] 試圖在 this.selectedItem 為 undefined 的狀態下變更分類！已強制中斷執行以保護系統。');
            return; 
        }

        const selectedVal = event.target.value;
        const hourDisplay = document.getElementById('preview-mfd-hour-display');
        
        // 🚨 架構師修正：因為沒有 UI 了，我們只需負責重置時間資料即可
        if (selectedVal === 'custom') {
            if (hourDisplay) {
                hourDisplay.dataset.hour = '0';
                hourDisplay.innerText = '00';
            }
        } else {
            const sysTime = DateHelper.getCurrentRoundedTime();
            if (hourDisplay) {
                hourDisplay.dataset.hour = sysTime.hour;
                hourDisplay.innerText = String(sysTime.hour).padStart(2, '0');
            }
            this.ui.previewMfdInput.value = sysTime.dateString;
        }

        this.recalculateEXD();
    }

   // src/controllers/MainController.js (僅節錄 recalculateEXD 進行覆蓋)

   recalculateEXD() {
        if (!this.selectedItem) return;
        
        // 🚨 攔截預覽：如果是自訂標籤，直接顯示提示字眼並退出計算
        const isCustomLabel = (this.selectedItem.internalId === 'SYS-BLANK' || this.selectedItem.internalId === 'SYS-CUSTOM');
        
        if (isCustomLabel) return;
        
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

        if (selectedVal === 'cat1') {
            hoursToAdd = parseInt(this.selectedItem.expireHours1, 10) || 0;
        } else if (selectedVal === 'cat2') {
            hoursToAdd = parseInt(this.selectedItem.expireHours2, 10) || 0;
        }

        const { mfdPrint, exdPrintLine1, exdPrintLine2 } = DateHelper.calculateEXD(mfdStr, mfdHour, hoursToAdd);
        
        const isHandwriting = (selectedVal === 'custom');
        
        let categoryText = isHandwriting 
            ? '手寫標籤'
            : this.selectedItem[`category${selectedVal === 'cat1' ? '1' : '2'}`];

        const isBlankItem = (categoryText === '空白' || this.selectedItem.internalId === 'SYS-BLANK');
        
        // --- 🟢 核心修改：靜態渲染畫面改用「起/迄」 ---
        if (isHandwriting) {
            this.ui.previewMfdDisplay.innerText = '起:      .   .   ';
            this.ui.previewExdText.innerHTML = `迄: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;時`;
        } else if (isBlankItem) {
            this.ui.previewMfdDisplay.innerText = mfdPrint; 
            this.ui.previewExdText.innerHTML = `迄: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;時`;
        } else {
            this.ui.previewMfdDisplay.innerText = mfdPrint;
            this.ui.previewExdText.innerHTML = `${exdPrintLine1}<br>${exdPrintLine2}`;
        }

        this.ui.previewCategoryText.innerText = isBlankItem ? '' : categoryText;
        
        // --- 🟢 核心修改：打包給印表機的二進位字串同步改用「起/迄」 ---
        this.currentPrintData = {
            mfdPrint: isHandwriting ? '起:      .   .   ' : mfdPrint,
            category: isBlankItem ? '' : `用途: ${categoryText}`,
            exdLine1: (isHandwriting || isBlankItem) ? '迄:         .       .       ' : exdPrintLine1,
            exdLine2: (isHandwriting || isBlankItem) ? '                       時' : exdPrintLine2
        };
    }

    async handlePrintAction() {
        if (!this.selectedItem) return;
        
        const isCustomLabel = (this.selectedItem.internalId === 'SYS-BLANK' || this.selectedItem.internalId === 'SYS-CUSTOM');
        const customInput = document.getElementById('custom-label-input');
        
        // 防呆：如果是自訂標籤，但店員沒打字就按列印，直接擋下
        if (isCustomLabel && (!customInput.value || customInput.value.trim() === '')) {
            this.ui.showToast('請輸入自訂標籤內容！', 'error');
            return;
        }

        const btn = this.ui.btnPrint;
        const originalText = btn.innerHTML;
        const qty = parseInt(this.ui.qtyInput.value, 10) || 1;
        
        const targetIp = localStorage.getItem('middlewareIp'); 
        const printerIp = localStorage.getItem('printerIp');
        const lang = localStorage.getItem('printerLang') || 'ZPL';
        
        if (!targetIp || !printerIp) {
            this.ui.showToast('尚未設定中介電腦或印表機 IP。', 'error');
            return;
        }

        try {
            btn.disabled = true;
            btn.innerHTML = `⏳ 傳輸中 (${lang})...`;
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            // 🚨 將 Flag 與文字封裝進 printData 傳給 PrintService
            const printData = {
                empName: this.ui.employeeNameInput.value || '',
                itemName: this.selectedItem.labelName,
                isCustom: isCustomLabel,
                customText: isCustomLabel ? customInput.value.trim() : '',
                ...this.currentPrintData
            };
            
            const finalCommand = await printService.generateCommand(lang, printData, qty);
            await printService.sendPrintJob(targetIp, printerIp, finalCommand);
            
            this.ui.showToast(`標籤已成功送出！`);
        } catch (error) {
            this.ui.showToast(`列印失敗: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        this.ui.toggleDrawer(false);
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
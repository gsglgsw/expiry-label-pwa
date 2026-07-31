// src/views/UI.js

export class UIManager {
    constructor() {
        this.categoryMenu = document.getElementById('category-menu');
        this.currentCategoryTitle = document.getElementById('current-category-title');
        this.itemGridContainer = document.getElementById('item-grid-container');
        this.searchInput = document.getElementById('item-search-input');
        
        this.employeeNameInput = document.getElementById('employee-name');
        this.previewEmptyState = document.getElementById('preview-empty-state');
        this.previewActiveState = document.getElementById('preview-active-state');
        
        // 🚨 新增：抽屜與遮罩層 DOM 綁定
        this.printDrawer = document.getElementById('print-drawer');
        this.drawerBackdrop = document.getElementById('drawer-backdrop');
        this.btnCloseDrawer = document.getElementById('btn-close-drawer');
        
        this.previewEmpName = document.getElementById('preview-emp-name');
        this.previewItemName = document.getElementById('preview-item-name');
        this.previewCategoryText = document.getElementById('preview-category-text');
        this.previewExdText = document.getElementById('preview-exd-text');
        
        this.categorySelect = document.getElementById('preview-category-select');
        this.qtyInput = document.getElementById('print-quantity');
        this.btnQtyMinus = document.getElementById('btn-qty-minus');
        this.btnQtyPlus = document.getElementById('btn-qty-plus');
        this.btnPrint = document.getElementById('btn-print');
        
        this.btnOpenSettings = document.getElementById('btn-open-settings');
        this.settingsModal = document.getElementById('settings-modal');
        this.printerIpInput = document.getElementById('printer-ip-input');
        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnSaveSettings = document.getElementById('btn-save-settings');

        this.previewMfdDisplay = document.getElementById('preview-mfd-display');
        this.previewMfdInput = document.getElementById('preview-mfd-input');
        this.previewMfdHourSelect = document.getElementById('preview-mfd-hour-select');

        this.loadingOverlay = document.getElementById('global-loading-overlay');
        this.loadingText = document.getElementById('global-loading-text');
        
        this.initBasicUIEvents();
    }
    
    initBasicUIEvents() {
        this.employeeNameInput.addEventListener('input', (e) => {
            this.previewEmpName.innerText = e.target.value || '';
        });

        // 🚨 綁定雙重防呆關閉機制
        if (this.drawerBackdrop && this.btnCloseDrawer) {
            this.drawerBackdrop.addEventListener('click', () => this.toggleDrawer(false));
            this.btnCloseDrawer.addEventListener('click', () => this.toggleDrawer(false));
        }

        const btnHourMinus = document.getElementById('btn-mfd-hour-minus');
        const btnHourPlus = document.getElementById('btn-mfd-hour-plus');
        const hourDisplay = document.getElementById('preview-mfd-hour-display');

        const updateHour = (delta) => {
            let currentHour = parseInt(hourDisplay.dataset.hour, 10);
            currentHour += delta;
            if (currentHour < 0) currentHour = 23;
            if (currentHour > 23) currentHour = 0;
            
            hourDisplay.dataset.hour = currentHour;
            hourDisplay.innerText = String(currentHour).padStart(2, '0');
            hourDisplay.dispatchEvent(new Event('hourChanged'));
        };

        if (btnHourMinus && btnHourPlus) {
            btnHourMinus.addEventListener('click', () => updateHour(-1));
            btnHourPlus.addEventListener('click', () => updateHour(1));
        }

        const mfdTrigger = document.getElementById('mfd-date-trigger');
        if (mfdTrigger) {
            mfdTrigger.addEventListener('click', () => {
                try {
                    this.previewMfdInput.showPicker();
                } catch (e) {
                    this.previewMfdInput.focus();
                }
            });
        }

        this.btnQtyMinus.addEventListener('click', () => {
            let val = parseInt(this.qtyInput.value) || 1;
            this.qtyInput.value = val > 1 ? val - 1 : 1;
        });

        this.btnQtyPlus.addEventListener('click', () => {
            let val = parseInt(this.qtyInput.value) || 1;
            this.qtyInput.value = val < 99 ? val + 1 : 99;
        });

        this.qtyInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 99) val = 99;
            e.target.value = val;
        });
    }

    // 🚨 新增：處理抽屜面板的開關狀態與動畫
    toggleDrawer(isShow) {
        if (!this.printDrawer || !this.drawerBackdrop) return;
        
        if (isShow) {
            this.drawerBackdrop.classList.remove('hidden');
            // 強制瀏覽器重繪 (Reflow)，確保 CSS Transition 能正常觸發
            void this.drawerBackdrop.offsetWidth;
            this.drawerBackdrop.classList.remove('opacity-0');
            this.printDrawer.classList.remove('translate-x-full');
        } else {
            this.printDrawer.classList.add('translate-x-full');
            this.drawerBackdrop.classList.add('opacity-0');
            // 等待動畫結束後，將遮罩徹底隱藏避免阻擋點擊
            setTimeout(() => {
                this.drawerBackdrop.classList.add('hidden');
            }, 300);
        }
    }

    renderCategoryMenu(categories, onSelectCallback) {
        this.categoryMenu.innerHTML = ''; 
        const allBtn = this.createCategoryElement('全部商品', true);
        allBtn.addEventListener('click', () => onSelectCallback('全部商品'));
        this.categoryMenu.appendChild(allBtn);

        categories.forEach(category => {
            const li = this.createCategoryElement(category, false);
            li.addEventListener('click', () => onSelectCallback(category));
            this.categoryMenu.appendChild(li);
        });
    }

    createCategoryElement(name, isActive) {
        const li = document.createElement('li');
        
        // 🚨 核心優化：縮小手機版 padding (px-3 py-2) 與字體 (text-base)，並加入 whitespace-nowrap 強制橫向顯示
        const baseClasses = "flex-shrink-0 px-3 py-2 md:px-5 md:py-4 text-base md:text-lg font-bold text-center border-b-4 lg:border-b border-transparent cursor-pointer transition-colors snap-center whitespace-nowrap flex items-center justify-center";
        
        li.className = isActive 
            ? `${baseClasses} text-white border-b-blue-400 lg:border-b-slate-700 bg-blue-600` 
            : `${baseClasses} text-slate-300 hover:text-white hover:bg-slate-700 lg:border-b-slate-700`;
            
        li.innerText = name;
        li.dataset.category = name;
        return li;
    }

    renderItemGrid(items, onSelectCallback) {
        this.itemGridContainer.innerHTML = ''; 

        if (items.length === 0) {
            this.itemGridContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 text-xl font-bold mt-10">查無商品</div>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            // 🚨 核心優化：改為清單按鍵設計，設定最小高度，移除原本強制的 aspect-square
            card.className = "bg-white px-2 py-4 md:px-4 md:py-5 rounded-2xl shadow-sm border-2 border-slate-200 hover:border-blue-500 cursor-pointer transition-all active:scale-95 flex items-center justify-center min-h-[80px] md:min-h-[100px]";
            
            // 🚨 核心優化：只留下商品名稱。加入 break-words 與 leading-tight 確保長文字自動換行且不會吃字
            card.innerHTML = `
                <div class="text-lg md:text-xl font-black text-gray-800 leading-snug break-words text-center w-full">
                    ${item.labelName}
                </div>
            `;
            card.addEventListener('click', () => onSelectCallback(item));
            this.itemGridContainer.appendChild(card);
        });
    }

    updateActiveCategoryUI(selectedCategory) {
        this.currentCategoryTitle.innerText = selectedCategory;
        const allLis = this.categoryMenu.querySelectorAll('li');
        allLis.forEach(li => {
            if (li.dataset.category === selectedCategory) {
                li.className = "p-5 text-xl font-bold text-center border-b border-slate-700 cursor-pointer transition-colors active:bg-slate-600 bg-blue-600 text-white";
            } else {
                li.className = "p-5 text-xl font-bold text-center border-b border-slate-700 cursor-pointer transition-colors active:bg-slate-600 hover:bg-slate-700 text-slate-300";
            }
        });
    }

    showPrintPanel(itemData) {
        this.previewEmptyState.classList.add('opacity-0', 'pointer-events-none');
        this.previewActiveState.classList.remove('opacity-0', 'pointer-events-none');

        this.previewItemName.innerText = itemData.labelName;
        this.previewEmpName.innerText = this.employeeNameInput.value || '';

        this.categorySelect.innerHTML = '';
        this.qtyInput.value = 1;
        
        // 🚨 核心邏輯：當選擇商品後，自動彈出列印抽屜 (僅在小螢幕作用，大螢幕會因 Tailwind 覆蓋而無視)
        this.toggleDrawer(true);
    }

    resetToEmptyState() {
        this.previewActiveState.classList.add('opacity-0', 'pointer-events-none');
        this.previewEmptyState.classList.remove('opacity-0', 'pointer-events-none');
        
        // 🚨 核心邏輯：當取消選擇時，自動收合抽屜
        this.toggleDrawer(false);
    }

    toggleSettingsModal(isShow) {
        if (isShow) this.settingsModal.classList.remove('hidden');
        else this.settingsModal.classList.add('hidden');
    }
    
    getPrinterIp() { return this.printerIpInput.value.trim(); }
    setPrinterIp(ipStr) { this.printerIpInput.value = ipStr; }

    showLoading(message = '處理中...') {
        if (!this.loadingOverlay) return;
        this.loadingText.innerText = message;
        this.loadingOverlay.classList.remove('hidden');
        setTimeout(() => {
            this.loadingOverlay.classList.remove('opacity-0');
            this.loadingOverlay.classList.add('opacity-100');
        }, 10);
    }

    hideLoading() {
        if (!this.loadingOverlay) return;
        this.loadingOverlay.classList.remove('opacity-100');
        this.loadingOverlay.classList.add('opacity-0');
        setTimeout(() => {
            this.loadingOverlay.classList.add('hidden');
        }, 300);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        let colorClass = 'bg-gray-800'; 
        let icon = '';
        if (type === 'success') { colorClass = 'bg-green-600'; icon = '✅ '; } 
        else if (type === 'error') { colorClass = 'bg-red-600'; icon = '❌ '; } 
        else if (type === 'warning') { colorClass = 'bg-yellow-500'; icon = '⚠️ '; }

        toast.className = `transform transition-all duration-300 translate-y-5 opacity-0 ${colorClass} text-white px-6 py-3 rounded shadow-xl flex items-center gap-2 pointer-events-auto max-w-sm`;
        toast.innerHTML = `<span>${icon} ${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-5', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-5', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
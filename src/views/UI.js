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
        
        this.previewEmpName = document.getElementById('preview-emp-name');
        this.previewItemName = document.getElementById('preview-item-name');
        this.previewCategoryText = document.getElementById('preview-category-text');
        this.previewExdText = document.getElementById('preview-exd-text');
        
        this.categorySelect = document.getElementById('preview-category-select');
        this.qtyInput = document.getElementById('print-quantity');
        this.btnQtyMinus = document.getElementById('btn-qty-minus');
        this.btnQtyPlus = document.getElementById('btn-qty-plus');
        this.btnPrint = document.getElementById('btn-print');
        
        // 🚨 架構師修正：已徹底刪除自訂用途面板的所有 DOM 綁定，避免記憶體洩漏與報錯
        
        this.btnOpenSettings = document.getElementById('btn-open-settings');
        this.settingsModal = document.getElementById('settings-modal');
        this.printerIpInput = document.getElementById('printer-ip-input');
        this.btnCloseSettings = document.getElementById('btn-close-settings');
        this.btnSaveSettings = document.getElementById('btn-save-settings');

        // MFD 控制 DOM
        this.previewMfdDisplay = document.getElementById('preview-mfd-display');
        this.previewMfdInput = document.getElementById('preview-mfd-input');
        this.previewMfdHourSelect = document.getElementById('preview-mfd-hour-select');

        this.loadingOverlay = document.getElementById('global-loading-overlay');
        this.loadingText = document.getElementById('global-loading-text');
        
        this.initBasicUIEvents();
    }
    
    initBasicUIEvents() {
        this.employeeNameInput.addEventListener('input', (e) => {
            // 🚨 架構師修正：若無輸入，直接回傳空字串
            this.previewEmpName.innerText = e.target.value || '';
        });

        // --- MFD 小時 Stepper 邏輯 ---
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
        
        // 🚨 架構師修正：已拔除 btnCustomDaysMinus 等所有相關事件監聽器
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
        const baseClasses = "p-5 text-xl font-bold text-center border-b border-slate-700 cursor-pointer transition-colors active:bg-slate-600";
        li.className = isActive ? `${baseClasses} bg-blue-600` : `${baseClasses} hover:bg-slate-700 text-slate-300`;
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
            card.className = "bg-white p-6 rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-400 hover:shadow-md cursor-pointer transition-all active:scale-95 flex flex-col justify-between aspect-square";
            card.innerHTML = `
                <div class="text-sm font-bold text-gray-400 truncate">${item.brandName || ''}</div>
                <div class="text-2xl font-black text-gray-800 line-clamp-2 mt-2 leading-tight">${item.labelName}</div>
                <div class="mt-auto pt-4 flex justify-between items-end border-t border-gray-100">
                    <span class="text-xs font-bold text-gray-400">${item.internalId || ''}</span>
                    <span class="text-sm font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">${item.category1}</span>
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
        // 🚨 架構師修正：若無輸入，直接回傳空字串
        this.previewEmpName.innerText = this.employeeNameInput.value || '';

        this.categorySelect.innerHTML = '';
        this.qtyInput.value = 1;
    }

    resetToEmptyState() {
        this.previewActiveState.classList.add('opacity-0', 'pointer-events-none');
        this.previewEmptyState.classList.remove('opacity-0', 'pointer-events-none');
    }

    // 🚨 架構師修正：已徹底移除 toggleCustomCategoryUI，不再操作不存在的 DOM

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
// src/controllers/LoginController.js

import { AuthService } from '../services/AuthService.js';
import DeviceManager from '../utils/DeviceManager.js'; 

export class LoginController {
    constructor(apiUrl, onLoginSuccess) {
        this.apiUrl = apiUrl;           
        this.currentPin = ""; 
        this.maxPinLength = 6; 
        this.onLoginSuccess = onLoginSuccess; 

        // 一般登入 UI
        this.loginView = document.getElementById('login-view');
        this.pinDisplay = document.getElementById('pin-display');
        this.errorMsg = document.getElementById('login-error-msg');
        this.numpadContainer = document.getElementById('numpad-container');

        // 👑 督導特權 UI
        this.superModal = document.getElementById('super-admin-modal');
        this.superSelect = document.getElementById('super-store-select');
        this.btnSuperEnter = document.getElementById('btn-super-enter');
        this.superCard = document.getElementById('super-admin-card');

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.initEventListeners();
    }

    initEventListeners() {
        this.numpadContainer.addEventListener('click', (event) => {
            const btn = event.target.closest('.numpad-btn');
            if (!btn) return; 

            const val = btn.dataset.val;
            const action = btn.dataset.action;

            if (val) this.handleNumberInput(val);
            else if (action === 'clear') this.handleClear();
            else if (action === 'submit') this.handleSubmit();
        });

        document.addEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown(event) {
        if (event.key >= '0' && event.key <= '9') {
            this.handleNumberInput(event.key);
        } else if (event.key === 'Backspace') {
            this.handleClear();
        } else if (event.key === 'Enter') {
            this.handleSubmit();
        }
    }

    handleNumberInput(num) {
        if (this.currentPin.length >= this.maxPinLength) return; 
        this.currentPin += num; 
        this.updateDisplay();   
        this.clearError();      
    }

    handleClear() {
        this.currentPin = this.currentPin.slice(0, -1);
        this.updateDisplay();
        this.clearError();
    }

    async handleSubmit() {
        if (this.currentPin.length < 4) {
            this.showError("請至少輸入 4 碼 PIN 碼");
            return;
        }

        const shortCode = DeviceManager.getShortCode();

        this.showError("連線與安全驗證中...", "text-blue-500");
        this.setNumpadState(true); 

        const response = await AuthService.verifyPin(this.apiUrl, this.currentPin, shortCode);

        if (response.success) {
            // 👑 攔截：如果是督導特權登入
            if (response.isSuperAdmin) {
                this.showSuperAdminModal(response.data);
                return; // 中止後續執行，等待督導選擇門市
            }

            // 👤 一般門市登入邏輯
            this.saveStoreSession(response.data);
            this.handleLoginSuccess(response.data.storeName);

        } else {
            // 🚨 拒絕存取邏輯
            if (response.errorCode === 'UNAUTHORIZED_DEVICE') {
                this.showError(`⚠️ 設備未註冊！請回報代碼：【 ${shortCode} 】`, "text-red-500");
            } else {
                this.showError(response.message || "PIN 碼錯誤", "text-red-500");
            }
            this.currentPin = ""; 
            this.updateDisplay();
            this.setNumpadState(false); 
        }
    }

    /**
     * 👑 觸發督導選單與處理流程
     */
    showSuperAdminModal(stores) {
        // 1. 動態生成下拉選單選項 (將門市資料整包存入 value 中以便後續取用)
        this.superSelect.innerHTML = stores.map(store => 
            `<option value='${JSON.stringify(store)}'>📍 ${store.storeName} (${store.brandName})</option>`
        ).join('');

        // 2. 顯示動畫
        this.superModal.classList.remove('hidden');
        // 確保 DOM 繪製後才加上透明度，達成滑順淡入
        requestAnimationFrame(() => {
            this.superModal.classList.remove('opacity-0');
            this.superModal.classList.add('opacity-100');
            this.superCard.classList.remove('scale-95');
            this.superCard.classList.add('scale-100');
        });

        // 3. 綁定「進入系統」按鈕 (使用 onclick 直接覆蓋，避免重複綁定)
        this.btnSuperEnter.onclick = () => {
            const selectedStoreData = JSON.parse(this.superSelect.value);
            
            // 鎖定按鈕避免連點
            this.btnSuperEnter.disabled = true;
            this.btnSuperEnter.innerText = '載入中...';

            // 儲存被選中的門市身分
            this.saveStoreSession(selectedStoreData);
            
            // 關閉彈窗並執行登入成功流程
            this.superModal.classList.remove('opacity-100');
            this.superModal.classList.add('opacity-0');
            setTimeout(() => {
                this.superModal.classList.add('hidden');
                this.handleLoginSuccess(`總部模式: ${selectedStoreData.storeName}`);
            }, 300);
        };
    }

    /**
     * 封裝儲存 LocalStorage 的邏輯 (DRY 原則)
     */
    saveStoreSession(data) {
        localStorage.setItem('storeId', data.storeId);
        localStorage.setItem('storeName', data.storeName);
        localStorage.setItem('brandName', data.brandName); 
        localStorage.setItem('middlewareIp', data.middlewareIp);
        if (data.printerIp) {
            localStorage.setItem('printerIp', data.printerIp);
        }
    }

    handleLoginSuccess(storeName) {
        this.showError(`登入成功！歡迎，${storeName}`, "text-green-500");
        document.removeEventListener('keydown', this.handleKeyDown);
        
        setTimeout(() => {
            this.loginView.classList.add('opacity-0');
            this.loginView.classList.add('pointer-events-none');
            
            if (this.onLoginSuccess) {
                this.onLoginSuccess();
            }
        }, 800);
    }

    updateDisplay() {
        this.pinDisplay.innerText = '*'.repeat(this.currentPin.length);
    }

    showError(msg, colorClass = "text-red-500") {
        this.errorMsg.className = `text-center mb-4 min-h-[24px] font-semibold transition-opacity opacity-100 ${colorClass}`;
        this.errorMsg.innerText = msg;
    }

    clearError() {
        this.errorMsg.classList.remove('opacity-100');
        this.errorMsg.classList.add('opacity-0');
    }

    setNumpadState(isDisabled) {
        const buttons = this.numpadContainer.querySelectorAll('.numpad-btn');
        buttons.forEach(btn => {
            btn.disabled = isDisabled;
            if (isDisabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    }
}
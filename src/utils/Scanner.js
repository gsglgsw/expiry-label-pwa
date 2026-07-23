// src/utils/Scanner.js
// 專門負責攔截實體掃描槍的輸入 (基於 Enter 鍵觸發)

export class ScannerInterceptor {
    constructor(inputId, onScanCallback) {
        this.inputEl = document.getElementById(inputId);
        this.onScan = onScanCallback;
        this.isPaused = false; // 💡 新增：暫停標記

        this.init();
    }

    init() {
        if (!this.inputEl) return;

        // 當條碼輸入完成 (按下 Enter) 時觸發回呼
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = this.inputEl.value.trim();
                if (val && !this.isPaused) { // 💡 確保未暫停才觸發
                    this.onScan(val);
                }
                this.inputEl.value = ''; // 清空準備下一次
            }
        });

        // 🛑 核心修復：智慧型 Blur 判定 (不搶 UI 元件的焦點)
        this.inputEl.addEventListener('blur', (e) => {
            if (!this.isPaused) {
                // e.relatedTarget 可以知道焦點「正準備轉移到誰身上」
                const nextFocus = e.relatedTarget;
                
                // 如果焦點轉移到了其他輸入框、下拉選單、或按鈕上，我們就放行！
                const isInteractive = nextFocus && ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(nextFocus.tagName);
                
                if (!isInteractive) {
                    // 只有當失去焦點且沒有點擊其他元件時(例如點到背景)，才搶回焦點
                    setTimeout(() => this.inputEl.focus(), 10);
                }
            }
        });
        // 🛑 核心修復：智慧型 Click 判定 (點擊空白處才重新對焦)
        document.addEventListener('click', (e) => {
            if (!this.isPaused) {
                // e.target.closest 檢查使用者點擊的目標，是不是包含在互動元件內部
                const clickedInteractive = e.target.closest('input, select, button, a, textarea');
                
                if (!clickedInteractive) {
                    // 只有明確點擊了「非操作區 (如純背景)」，才強制把游標拉回來
                    this.inputEl.focus();
                }
            }
        });
    }

    // 💡 新增：供外部呼叫的暫停與恢復方法
    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.inputEl.focus(); // 恢復時立刻把焦點抓回來
    }
}
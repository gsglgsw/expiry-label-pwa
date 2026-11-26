// src/utils/ClockGuard.js
// 設備時間檢查：效期的「起」是用這台設備的系統時間算的，
// 設備時鐘錯了就會印出錯誤的效期，所以定期和網路時間比對，差太多就顯示紅色警告。
//
// 網路時間來源：GitHub Pages 回應的 Date 標頭（同網域可讀取，不需要動 GAS）。
// 離線時不檢查，也不顯示警告（避免誤報）。

const THRESHOLD_MS = 10 * 60 * 1000;      // 誤差超過 10 分鐘才警告
const RECHECK_MS = 30 * 60 * 1000;        // 每 30 分鐘重新檢查
const PROBE_URL = './sw.js';              // 任何同網域檔案都可以，加參數避開快取

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export class ClockGuard {
    constructor() {
        this.banner = null;
        this.lastCheck = 0;
        this.check();
        setInterval(() => this.check(), RECHECK_MS);
        // 從背景切回來（店員隔天打開 App）時也檢查
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && Date.now() - this.lastCheck > 60 * 1000) this.check();
        });
        window.addEventListener('online', () => this.check());
    }

    /** 回傳 { offsetMs, serverTime } ；離線或讀不到時間則回傳 null */
    async measure() {
        if (!navigator.onLine) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const t0 = Date.now();
            const res = await fetch(`${PROBE_URL}?clock=${t0}`, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
            const t1 = Date.now();
            const header = res.headers.get('Date');
            if (!header) return null;
            // Date 標頭只到秒，加上一半的往返時間估計「伺服器此刻」的時間
            const serverNow = new Date(header).getTime() + (t1 - t0) / 2;
            if (Number.isNaN(serverNow)) return null;
            return { offsetMs: Date.now() - serverNow, serverTime: new Date(serverNow) };
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    async check() {
        this.lastCheck = Date.now();
        const result = await this.measure();
        if (!result) {
            // 網路慢或暫時不通（例如剛登入畫面還在載入）：維持目前狀態，1 分鐘後再試一次
            clearTimeout(this.retryTimer);
            this.retryTimer = setTimeout(() => this.check(), 60 * 1000);
            return;
        }
        clearTimeout(this.retryTimer);
        if (Math.abs(result.offsetMs) > THRESHOLD_MS) {
            this.showWarning(result);
        } else {
            this.hideWarning();
        }
        return result;
    }

    showWarning({ offsetMs, serverTime }) {
        if (!this.banner) {
            this.banner = document.createElement('div');
            this.banner.className = 'fixed top-0 inset-x-0 z-[9500] bg-red-600 text-white shadow-lg px-4 py-3 text-center';
            this.banner.setAttribute('role', 'alert');
            document.body.appendChild(this.banner);
        }
        const minutes = Math.round(Math.abs(offsetMs) / 60000);
        const diff = minutes >= 120 ? `${Math.round(minutes / 60)} 小時` : `${minutes} 分鐘`;
        const direction = offsetMs > 0 ? '快' : '慢';
        const deviceTime = new Date(Date.now());

        const title = document.createElement('p');
        title.className = 'font-black text-lg';
        title.textContent = `⚠️ 這台設備的時間不正確（${direction}了 ${diff}），印出的效期會錯！`;
        const detail = document.createElement('p');
        detail.className = 'text-sm mt-1';
        detail.textContent = `設備時間 ${fmt(deviceTime)}｜正確時間 ${fmt(serverTime)}。請到「設定 → 日期與時間」開啟「自動設定」，再按「重新檢查」。`;
        const btn = document.createElement('button');
        btn.className = 'mt-2 bg-white text-red-700 font-bold px-4 py-1 rounded-lg text-sm';
        btn.textContent = '🔄 重新檢查';
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = '檢查中…';
            await this.check();
            if (this.banner) { btn.disabled = false; btn.textContent = '🔄 重新檢查'; }
        });
        this.banner.replaceChildren(title, detail, btn);
    }

    hideWarning() {
        if (this.banner) {
            this.banner.remove();
            this.banner = null;
        }
    }
}

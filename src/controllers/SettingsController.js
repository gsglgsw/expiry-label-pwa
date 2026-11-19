// src/controllers/SettingsController.js
// ⚙️ 門市連線設定視窗：比對「這台 iPad 目前使用的 IP」與「Sheet 上應設定的 IP」，
// 可一鍵同步，並測試 iPad 到中介電腦的連線。食材資料同步仍由主畫面的「同步」按鈕負責。

import DeviceManager from '../utils/DeviceManager.js';

const FIELDS = [
    { key: 'middlewareIp', label: '中介電腦 IP' },
    { key: 'printerIp', label: '標籤機 IP' },
    { key: 'printerLang', label: '標籤機語言' }
];

const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
};

export class SettingsController {
    constructor(uiManager) {
        this.ui = uiManager;
        this.remote = null; // Sheet 上的設定
        this.buildModal();
        const openBtn = document.getElementById('btn-open-settings');
        if (openBtn) openBtn.addEventListener('click', () => this.open());
    }

    // ---------------------------------------------------------
    // 畫面
    // ---------------------------------------------------------
    buildModal() {
        this.modal = el('div', 'fixed inset-0 z-[9000] hidden items-center justify-center bg-black/50 p-4');
        this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });

        const card = el('div', 'bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full overflow-y-auto');

        const header = el('div', 'flex items-center justify-between px-5 py-4 border-b');
        header.appendChild(el('h3', 'text-lg font-bold text-slate-800', '⚙️ 門市連線設定'));
        const closeBtn = el('button', 'text-gray-400 hover:text-gray-700 text-2xl leading-none px-2', '×');
        closeBtn.addEventListener('click', () => this.close());
        header.appendChild(closeBtn);

        const body = el('div', 'px-5 py-4 space-y-4');
        this.storeLine = el('p', 'text-sm text-gray-600');

        const table = el('table', 'w-full text-sm border-collapse');
        const thead = el('thead');
        const hr = el('tr', 'text-left text-xs text-gray-500 border-b');
        ['項目', '這台 iPad 目前', 'Sheet 應設定'].forEach(t => hr.appendChild(el('th', 'py-2 pr-2 font-semibold', t)));
        thead.appendChild(hr);
        this.tbody = el('tbody');
        table.append(thead, this.tbody);

        this.middlewareInfo = el('p', 'text-xs text-gray-500');
        this.statusLine = el('p', 'text-sm');
        this.testResult = el('div', 'hidden text-sm rounded-lg p-3 whitespace-pre-line');

        const buttons = el('div', 'grid grid-cols-2 gap-3 pt-1');
        this.testBtn = el('button', 'bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-all', '🔍 測試中介連線');
        this.syncBtn = el('button', 'bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-all', '🔄 同步 IP 設定');
        this.testBtn.addEventListener('click', () => this.testMiddleware());
        this.syncBtn.addEventListener('click', () => this.syncIps());
        buttons.append(this.testBtn, this.syncBtn);

        const note = el('p', 'text-xs text-gray-400',
            '「同步 IP 設定」只更新 IP；食材資料請用主畫面的「同步」按鈕。');

        body.append(this.storeLine, table, this.middlewareInfo, this.statusLine, buttons, this.testResult, note);
        card.append(header, body);
        this.modal.appendChild(card);
        document.body.appendChild(this.modal);
    }

    open() {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
        this.testResult.classList.add('hidden');
        const name = localStorage.getItem('storeName') || '';
        const id = localStorage.getItem('storeId') || '';
        this.storeLine.textContent = `門市：${name}（${id}）`;
        this.remote = null;
        this.render();
        this.fetchRemote();
    }

    close() {
        this.modal.classList.add('hidden');
        this.modal.classList.remove('flex');
    }

    local() {
        return {
            middlewareIp: localStorage.getItem('middlewareIp') || '',
            printerIp: localStorage.getItem('printerIp') || '',
            printerLang: (localStorage.getItem('printerLang') || '').toUpperCase()
        };
    }

    render() {
        const local = this.local();
        this.tbody.replaceChildren();
        FIELDS.forEach(({ key, label }) => {
            const tr = el('tr', 'border-b last:border-0');
            const remoteVal = this.remote ? (this.remote[key] || '（未填）') : '讀取中…';
            const differs = this.remote && (this.remote[key] || '') !== local[key];
            if (differs) tr.classList.add('bg-amber-50');
            tr.appendChild(el('td', 'py-2 pr-2 text-gray-600', label));
            tr.appendChild(el('td', `py-2 pr-2 font-mono ${differs ? 'text-amber-700 font-bold' : ''}`, local[key] || '（未設定）'));
            tr.appendChild(el('td', 'py-2 font-mono', (differs ? '⚠️ ' : (this.remote ? '✓ ' : '')) + remoteVal));
            this.tbody.appendChild(tr);
        });

        if (this.remote) {
            const v = this.remote.middlewareVersion || '未知';
            const seen = this.remote.middlewareLastSeen || '無紀錄';
            this.middlewareInfo.textContent = `中介程式版本：${v}｜最後回報：${seen}`;
        } else {
            this.middlewareInfo.textContent = '';
        }
    }

    setStatus(text, tone = 'gray') {
        const colors = { gray: 'text-gray-500', ok: 'text-green-700', warn: 'text-amber-700', err: 'text-red-600' };
        this.statusLine.className = `text-sm ${colors[tone]}`;
        this.statusLine.textContent = text;
    }

    differences() {
        if (!this.remote) return [];
        const local = this.local();
        return FIELDS.filter(({ key }) => this.remote[key] && this.remote[key] !== local[key]);
    }

    // ---------------------------------------------------------
    // 向 GAS 查詢 Sheet 上的設定
    // ---------------------------------------------------------
    async requestConfig() {
        const apiUrl = localStorage.getItem('apiUrl');
        const storeId = localStorage.getItem('storeId');
        if (!apiUrl || !storeId) throw new Error('缺少登入資料，請重新登入');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getStoreConfig', storeId, deviceId: DeviceManager.getDeviceId() })
        });
        if (!response.ok) throw new Error(`雲端回應異常（${response.status}）`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '查詢失敗');
        return result.data;
    }

    async fetchRemote() {
        this.setStatus('正在讀取 Sheet 上的設定…');
        try {
            this.remote = await this.requestConfig();
            this.render();
            const diff = this.differences();
            if (diff.length) {
                this.setStatus(`有 ${diff.length} 項與 Sheet 不同，按「同步 IP 設定」即可更新。`, 'warn');
            } else {
                this.setStatus('這台 iPad 的設定與 Sheet 一致。', 'ok');
            }
        } catch (e) {
            this.render();
            this.setStatus(`無法讀取 Sheet 設定：${e.message}`, 'err');
        }
    }

    async syncIps() {
        this.syncBtn.disabled = true;
        this.syncBtn.classList.add('opacity-50');
        try {
            this.remote = await this.requestConfig();
            const local = this.local();
            const changes = this.differences();
            changes.forEach(({ key }) => localStorage.setItem(key, this.remote[key]));
            this.render();
            if (changes.length) {
                const summary = changes.map(({ key, label }) => `${label} ${local[key] || '（空）'} → ${this.remote[key]}`).join('\n');
                this.setStatus(`已更新：\n${summary}`, 'ok');
                this.statusLine.classList.add('whitespace-pre-line');
                this.ui.showToast('IP 設定已更新', 'success');
            } else {
                this.setStatus('IP 設定已是最新，不需要更新。', 'ok');
            }
        } catch (e) {
            this.setStatus(`同步失敗：${e.message}`, 'err');
        } finally {
            this.syncBtn.disabled = false;
            this.syncBtn.classList.remove('opacity-50');
        }
    }

    // ---------------------------------------------------------
    // 測試 iPad → 中介電腦（不會列印）
    // ---------------------------------------------------------
    async testMiddleware() {
        const ip = localStorage.getItem('middlewareIp');
        const show = (text, ok) => {
            this.testResult.className = `text-sm rounded-lg p-3 whitespace-pre-line ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`;
            this.testResult.textContent = text;
        };
        if (!ip) return show('這台 iPad 沒有設定中介電腦 IP，請先「同步 IP 設定」。', false);

        this.testBtn.disabled = true;
        this.testBtn.classList.add('opacity-50');
        show(`測試中：https://${ip}:3000 …`, true);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const t0 = performance.now();
        try {
            const res = await fetch(`https://${ip}:3000/api/status`, { signal: controller.signal });
            const ms = Math.round(performance.now() - t0);
            if (res.status === 404) {
                show(`✅ 連線正常（${ms}ms）\n中介程式是 1.0 版（沒有狀態頁）`, true);
            } else {
                const s = await res.json();
                const lines = [
                    `✅ 連線正常（${ms}ms）`,
                    `中介程式版本：${s.version}｜門市代號：${s.storeId || '未設定'}`,
                    s.certCoversIp === false ? '⚠️ 憑證不涵蓋目前 IP' : null,
                    s.storeId && s.storeId !== localStorage.getItem('storeId')
                        ? `⚠️ 中介程式的門市代號（${s.storeId}）和這台 iPad（${localStorage.getItem('storeId')}）不同` : null
                ].filter(Boolean);
                show(lines.join('\n'), true);
            }
        } catch (e) {
            show(e.name === 'AbortError'
                ? `❌ 中介電腦 ${ip} 沒有回應（8 秒）\n請確認行政電腦有開機、網路正常`
                : `❌ 連不到中介電腦 ${ip}\n可能原因：\n・行政電腦沒開機或中介程式沒執行\n・iPad 連到別的 Wi-Fi\n・iPad 未信任憑證（用 Safari 開 https://${ip}:3000/api/status 檢查）\n・Sheet 上的中介 IP 不正確`, false);
        } finally {
            clearTimeout(timer);
            this.testBtn.disabled = false;
            this.testBtn.classList.remove('opacity-50');
        }
    }
}

// src/services/PrintService.js

// 🚨 依賴注入：引入全域設定檔，確保 API Key 不寫死
import { SYS_CONFIG } from '../config.js';

class PrintService {
    /**
     * ==========================================
     * 🟢 [路由層] 根據指定語言動態產出列印指令
     * 注意：因為 Canvas 繪圖是非同步的，此函式必須是 async
     * ==========================================
     */
    async generateCommand(lang, printData, qty) {
        if (lang === 'EZPL') {
            return await this.generateEZPLGraphic(printData, qty);
        }
        // 預設 fallback 為 TSPL (文字模式)
        return this.generateTSPL(printData, qty);
    }

    /**
     * ==========================================
     * 🎨 [核心渲染層] EZPL 圖形渲染引擎 (Canvas 轉 Hex)
     * ==========================================
     */
    async generateEZPLGraphic(printData, qty) {
        // 1. 繪製虛擬標籤 (40x50mm 於 203dpi 約等於 320x400 dots)
        const canvas = document.createElement('canvas');
        canvas.width = 320; 
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // 填滿白底 (防止透明背景轉碼出錯)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 繪製黑色文字 (徹底擺脫印表機字庫限制)
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top'; // 統一文字對齊基準線

        ctx.font = 'bold 24px sans-serif'; 
        ctx.fillText(`員工: ${printData.empName}`, 10, 20);
        
        ctx.font = 'bold 24px sans-serif'; 
        ctx.fillText(`${printData.mfdPrint}`, 150, 20);
        
        ctx.font = 'bold 42px sans-serif'; // 商品名稱放大
        ctx.fillText(printData.itemName, 10, 80); 
        
        ctx.font = '24px sans-serif';
        ctx.fillText(printData.category, 10, 150);

        ctx.font = '24px sans-serif';
        ctx.fillText(printData.exdLine1, 10, 200);

        ctx.font = '24px sans-serif';
        ctx.fillText(printData.exdLine2, 10, 250);

        // 2. 取得像素資料並轉換為 1BPP 單色 Hex 字串
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { hexString, widthBytes, height } = this._convertImageDataToHex(imageData);

        // 3. 組合 EZPL 實體控制指令 (包含你要求的 18mm 停歇點)
        const ezplCommand = `
^Q40,3,18
^W50
^H10
^P${qty}
^S2
^L
GW0,0,${widthBytes},${height},${hexString}
E
        `.trim();

        // 強制轉換為工業級印表機唯一認可的 \r\n 換行符號
        return ezplCommand.replace(/\r?\n/g, '\r\n') + '\r\n';
    }

    /**
     * 🔧 [底層轉碼器] 隱藏的私有方法：將 RGBA 轉為 16 進位單色字串
     */
    _convertImageDataToHex(imageData) {
        const { data, width, height } = imageData;
        let hexString = '';
        const widthBytes = Math.ceil(width / 8); 

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < widthBytes; x++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const pixelX = x * 8 + bit;
                    if (pixelX < width) {
                        const index = (y * width + pixelX) * 4;
                        // 灰階二值化：RGB 平均亮度小於 128 視為黑色 (1)
                        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
                        if (brightness < 128) {
                            byte |= (1 << (7 - bit)); 
                        }
                    }
                }
                hexString += byte.toString(16).padStart(2, '0').toUpperCase();
            }
        }
        return { hexString, widthBytes, height };
    }

    /**
     * ==========================================
     * 📜 [TSPL 備援層] 傳統文字模式
     * ==========================================
     */
    generateTSPL(printData, qty) {
        const tsplCommand = `
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
        return tsplCommand.replace(/\r?\n/g, '\r\n') + '\r\n';
    }

    /**
     * ==========================================
     * 📡 [網路通訊層] 發送指令至 Node.js 中介層
     * ==========================================
     */
    async sendPrintJob(middlewareIp, printerIp, command) {
        const apiUrl = `http://${middlewareIp}:3000/api/print`; 

        try {
            console.log(`[PrintService] 準備發送列印任務至: ${printerIp}`);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': SYS_CONFIG.SECURE_API_KEY 
                },
                body: JSON.stringify({
                    printerIp: printerIp,
                    printCommand: command 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '中介層發生未知錯誤');
            }
            return await response.json();
        } catch (error) {
            console.error('[PrintService] API 連線失敗:', error.message);
            throw error; 
        }
    }
}

// 單例模式匯出 (Singleton)
export const printService = new PrintService();
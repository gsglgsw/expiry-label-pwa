// src/services/PrintService.js

import { SYS_CONFIG } from '../config.js';

class PrintService {
    /**
     * 🟢 [路由層] 根據指定語言動態產出列印指令
     */
    async generateCommand(lang, printData, qty) {
        if (lang === 'ZPL') {
            return await this.generateZPLGraphic(printData, qty);
        }
        // Fallback 
        return this.generateTSPL(printData, qty);
    }

    /**
     * 🎨 [核心渲染層] ZPL 圖形渲染引擎 (Canvas 轉 ASCII Hex)
     */
    /**
     * 🎨 [核心渲染層] ZPL 圖形渲染引擎 (Canvas 轉 ASCII Hex)
     */
    async generateZPLGraphic(printData, qty) {
        // 1. 建立實體紙張畫布 (物理寬度 320 dots, 物理高度 392 dots)
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 392;
        const ctx = canvas.getContext('2d');

        // 🚨 核心修正：將畫布順時針旋轉 90 度，實現橫向排版 (Landscape)
        ctx.save();
        ctx.translate(canvas.width, 0); 
        ctx.rotate(90 * Math.PI / 180); 

        // ==========================================
        // 📐 旋轉後的邏輯座標系：X 軸最大值 392，Y 軸最大值 320
        // ==========================================
        const LOGICAL_WIDTH = 392;
        const LOGICAL_HEIGHT = 320;

        // 填滿白底 (覆蓋整個邏輯畫布)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';

        // --- 區塊 1：左上角 (員工與 MFD 資訊) ---
        ctx.textAlign = 'left';
        
        ctx.font = '20px sans-serif'; // 小字體
        ctx.fillText(`員工: ${printData.empName}`, 15, 15);
        
        ctx.font = '22px sans-serif'; // 次小字體
        // MFD 靠左對齊，從 X=15 開始，擁有 377 dots 的寬廣空間，絕對不會再被切斷
        ctx.fillText(`${printData.mfdPrint}`, 15, 45); 

        // --- 區塊 2：中間層 (品名靠左、類別靠右) ---
        ctx.font = 'bold 44px sans-serif'; // 品名極大字體
        ctx.fillText(printData.itemName, 15, 100);

        ctx.textAlign = 'right'; // 🟢 切換為靠右對齊
        ctx.font = '24px sans-serif';
        // 貼齊右邊界 (392 - 15 = 377)，Y 軸稍微下沉與品名底部對齊
        ctx.fillText(printData.category, 377, 115); 

        // --- 區塊 3：底層 EXD (視覺焦點，置中特大字體) ---
        ctx.textAlign = 'center'; // 🟢 切換為置中對齊
        ctx.font = 'bold 40px sans-serif'; 
        
        // 放置在畫布正中間 (X = 392 / 2 = 196)
        ctx.fillText(printData.exdLine1, LOGICAL_WIDTH / 2, 180);
        ctx.fillText(printData.exdLine2, LOGICAL_WIDTH / 2, 230);

        ctx.restore(); // 恢復原始畫布狀態，準備進行像素轉換

        // 2. 獲取像素並轉為 16 進位字串
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { hexString, widthBytes, height, totalBytes } = this._convertImageDataToHex(imageData);

        // 3. 組合 ZPL 實體控制指令
        const zplCommand = `
^XA
^PW320
^LL392
^MNY
^FO0,0^GFA,${totalBytes},${totalBytes},${widthBytes},${hexString}
^PQ${qty}
^XZ
        `.trim();

        return zplCommand.replace(/\r?\n/g, '\r\n') + '\r\n';
    }

    /**
     * 🔧 [底層轉碼器] 將 RGBA 轉為 ZPL 認得的 1BPP 黑白 16 進位字串
     */
    _convertImageDataToHex(imageData) {
        const { data, width, height } = imageData;
        let hexString = '';
        const widthBytes = Math.ceil(width / 8);
        const totalBytes = widthBytes * height;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < widthBytes; x++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const pixelX = x * 8 + bit;
                    if (pixelX < width) {
                        const index = (y * width + pixelX) * 4;
                        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
                        // ZPL 中：1 為黑 (列印點)，0 為白 (不印點)
                        if (brightness < 128) {
                            byte |= (1 << (7 - bit));
                        }
                    }
                }
                hexString += byte.toString(16).padStart(2, '0').toUpperCase();
            }
        }
        return { hexString, widthBytes, height, totalBytes };
    }

    generateTSPL(printData, qty) {
        // ... (保留你原有的 TSPL 備援邏輯) ...
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
     * 📡 [網路通訊層] 回歸最單純的字串傳送
     */
    async sendPrintJob(middlewareIp, printerIp, command) {
        const apiUrl = `http://${middlewareIp}:3000/api/print`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': SYS_CONFIG.SECURE_API_KEY
                },
                body: JSON.stringify({
                    printerIp: printerIp,
                    printCommand: command // 單純傳送編譯好的 ZPL 字串
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '中介層發生未知錯誤');
            }
            return await response.json();
        } catch (error) {
            throw error;
        }
    }
}

export const printService = new PrintService();
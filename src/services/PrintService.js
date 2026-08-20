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
        // 🚨 核心升級：TSPL 也不再使用文字模式，全面導入圖形渲染引擎
        return await this.generateTSPLGraphic(printData, qty);
    }

    /**
     * 🎨 [核心渲染層] ZPL 圖形渲染引擎 (Canvas 轉 ASCII Hex)
     */
    async generateZPLGraphic(printData, qty) {
        // ... (ZPL 邏輯保持不變，為節省版面此處省略內部實作，請保留你原本的 ZPL 程式碼) ...
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 392;
        const ctx = canvas.getContext('2d');

        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.rotate(90 * Math.PI / 180);

        const LOGICAL_WIDTH = 392;
        const LOGICAL_HEIGHT = 320;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';

        ctx.textAlign = 'left';
        ctx.font = '20px sans-serif';
        ctx.fillText(`員工: ${printData.empName}`, 15, 15);
        ctx.font = '22px sans-serif';
        ctx.fillText(`${printData.mfdPrint}`, 15, 45);

        // 品名與防溢出壓縮
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText(printData.itemName, 15, 90, LOGICAL_WIDTH - 30);

        // 用途下移
        ctx.textAlign = 'right';
        ctx.font = '24px sans-serif';
        ctx.fillText(printData.category, 377, 140);

        // 迄時
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(printData.exdLine1, LOGICAL_WIDTH / 2, 185);
        ctx.fillText(printData.exdLine2, LOGICAL_WIDTH / 2, 235);
        ctx.restore();

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { hexString, widthBytes, height, totalBytes } = this._convertImageDataToHex(imageData);

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
     * 🎨 [核心渲染層] TSPL 圖形渲染引擎 (Canvas 轉 Base64 二進位)
     */
    async generateTSPLGraphic(printData, qty) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        ctx.save();
        ctx.translate(canvas.width, 0); 
        ctx.rotate(90 * Math.PI / 180); 

        const LOGICAL_WIDTH = 400;
        const LOGICAL_HEIGHT = 320;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.fillStyle = '#000000';
        
        // 🚨 分支攔截：判斷是否為自訂文字標籤
        if (printData.isCustom) {
            
            // 啟動智慧繪圖引擎 (居中、最大寬度留邊距)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            this._drawSmartText(ctx, printData.customText, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH - 40, LOGICAL_HEIGHT - 40);

        } else {
            // 🔵 [原有邏輯]：一般效期標籤 (座標系重構與防溢出優化)
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // 1. 員工與製造日期 (微調 Y 軸，使其更緊湊)
            ctx.font = '22px sans-serif'; 
            ctx.fillText(`員工: ${printData.empName}`, 15, 15);
            ctx.font = '24px sans-serif'; 
            ctx.fillText(`${printData.mfdPrint}`, 15, 45); 

            // 2. 品名 (Y=90)
            ctx.font = 'bold 46px sans-serif'; 
            // 🚨 架構師防呆：加入第 4 個參數 maxWidth (LOGICAL_WIDTH - 30)，
            // 當品名過長時，Canvas 會自動將字體「擠壓變扁」以塞進版面，絕對不會超出邊界！
            ctx.fillText(printData.itemName, 15, 90, LOGICAL_WIDTH - 30);

            // 3. 用途 (Y=145) - 成功下移至品名與迄時之間
            ctx.textAlign = 'right'; 
            ctx.font = '26px sans-serif';
            ctx.fillText(printData.category, LOGICAL_WIDTH - 15, 145); 

            // 4. 迄時 (Y=190 & 240)
            ctx.textAlign = 'center'; 
            ctx.font = 'bold 42px sans-serif'; 
            ctx.fillText(printData.exdLine1, LOGICAL_WIDTH / 2, 190);
            ctx.fillText(printData.exdLine2, LOGICAL_WIDTH / 2, 240);
        }

        ctx.restore();

        // 2. 獲取像素並轉為 TSPL 專用的 1BPP 二進位陣列
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { bitmapBytes, widthBytes, height } = this._convertImageDataToBinary(imageData);

        // 3. 組合 TSPL 實體控制指令 (設定尺寸、間距與清除緩衝區)
        const header = `SIZE 40 mm, 50 mm\r\nGAP 2 mm, 0\r\nDIRECTION 1\r\nCLS\r\nBITMAP 0,0,${widthBytes},${height},0,`;
        const footer = `\r\nPRINT 1,${qty}\r\n`;

        // 4. 打包為二進位 Payload
        const encoder = new TextEncoder();
        const headerBytes = encoder.encode(header);
        const footerBytes = encoder.encode(footer);

        const payload = new Uint8Array(headerBytes.length + bitmapBytes.length + footerBytes.length);
        payload.set(headerBytes, 0);
        payload.set(bitmapBytes, headerBytes.length);
        payload.set(footerBytes, headerBytes.length + bitmapBytes.length);

        // 5. 轉換為 Base64 字串，並加上特殊前綴，交由中介層解碼
        const base64String = this._uint8ToBase64(payload);
        return `__BASE64__${base64String}`;
    }

    /**
     * 🧠 [核心演算法] Canvas 智慧文字斷行 (支援中英文混排與手動換行)
     */
    _wrapText(ctx, text, maxWidth) {
        // 先處理使用者手動按 Enter 的換行 (\n)
        const rawLines = text.split('\n');
        const finalLines = [];

        rawLines.forEach(rawLine => {
            let currentLine = '';
            // 中文排版特性：逐字測量比逐詞 (split by space) 更精準且安全
            for (let i = 0; i < rawLine.length; i++) {
                const char = rawLine[i];
                const testLine = currentLine + char;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && i > 0) {
                    finalLines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            finalLines.push(currentLine);
        });
        return finalLines;
    }

    /**
     * 🧠 [核心演算法] 智慧縮放與多行繪製 (動態調整字體直到塞進邊界)
     */
    _drawSmartText(ctx, text, centerX, centerY, maxWidth, maxHeight) {
        
        // 🚨 架構師優化：解除封印！將最大字體從 55 暴增到 120 (約佔標籤高度 37.5%)
        let maxFontSize = 95; 
        
        // 稍微提升最小字體，確保就算字再多，印出來也不會糊成一團無法辨識
        let minFontSize = 24;  
        
        let currentFontSize = maxFontSize;
        let lines = [];
        let lineHeight = 1.2; // 行高比例

        // 迴圈遞減字體大小，直到文字總高度與寬度能完美塞進畫布
        while (currentFontSize >= minFontSize) {
            ctx.font = `bold ${currentFontSize}px sans-serif`;
            lines = this._wrapText(ctx, text, maxWidth);

            const totalHeight = lines.length * (currentFontSize * lineHeight);
            if (totalHeight <= maxHeight) {
                break; // 成功找到適合的字體大小，跳出迴圈
            }
            currentFontSize -= 2; // 若塞不下，字體縮小 2px 繼續嘗試
        }

        // 開始繪製多行文字，確保整體區塊絕對置中
        const totalTextHeight = lines.length * (currentFontSize * lineHeight);
        
        // 算出第一行文字的 Y 軸起始點
        let startY = centerY - (totalTextHeight / 2) + (currentFontSize / 2);

        lines.forEach((line, index) => {
            ctx.fillText(line, centerX, startY + (index * currentFontSize * lineHeight));
        });
    }

    _convertImageDataToHex(imageData) {
        // ... (保留原有的 ZPL 轉碼邏輯) ...
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
                        if (brightness < 128) byte |= (1 << (7 - bit));
                    }
                }
                hexString += byte.toString(16).padStart(2, '0').toUpperCase();
            }
        }
        return { hexString, widthBytes, height, totalBytes };
    }

    /**
     * 🔧 [底層轉碼器] 將 RGBA 轉為 TSPL 專用的 1BPP 二進位陣列
     */
    _convertImageDataToBinary(imageData) {
        const { data, width, height } = imageData;
        const widthBytes = Math.ceil(width / 8);
        const bitmapBytes = new Uint8Array(widthBytes * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < widthBytes; x++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const pixelX = x * 8 + bit;

                    if (pixelX < width) {
                        const index = (y * width + pixelX) * 4;
                        const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;

                        // 🚨 架構師除錯修正：
                        // TSPL (HPRT 實作) 中，0 代表黑點(印出)，1 代表白點(不印)
                        // 因此，當像素亮度高 (白色背景) 時，我們將該 bit 設為 1
                        if (brightness >= 128) {
                            byte |= (1 << (7 - bit));
                        }
                    } else {
                        // 🚨 防呆修正：處理寬度無法被 8 整除時的邊緣 Padding
                        // 超出畫布邊緣的空位，必須強制填入 1 (白色)，否則標籤右側會出現黑線
                        byte |= (1 << (7 - bit));
                    }
                }
                bitmapBytes[y * widthBytes + x] = byte;
            }
        }
        return { bitmapBytes, widthBytes, height };
    }

    _uint8ToBase64(uint8Array) {
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return window.btoa(binary);
    }

    /**
     * 📡 [網路通訊層] 
     */
    async sendPrintJob(middlewareIp, printerIp, command) {
        const apiUrl = `https://${middlewareIp}:3000/api/print`;
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': SYS_CONFIG.SECURE_API_KEY
                },
                body: JSON.stringify({
                    printerIp: printerIp,
                    printCommand: command // 若為圖形模式，此時夾帶的會是 __BASE64__ 字串
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
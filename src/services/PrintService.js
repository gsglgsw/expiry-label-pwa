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

        ctx.font = 'bold 44px sans-serif'; 
        ctx.fillText(printData.itemName, 15, 100);

        ctx.textAlign = 'right'; 
        ctx.font = '24px sans-serif';
        ctx.fillText(printData.category, 377, 115); 

        ctx.textAlign = 'center'; 
        ctx.font = 'bold 40px sans-serif'; 
        ctx.fillText(printData.exdLine1, LOGICAL_WIDTH / 2, 180);
        ctx.fillText(printData.exdLine2, LOGICAL_WIDTH / 2, 230);
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
        // 1. 建立實體畫布 (40mm x 50mm, 203dpi = 320 x 400 dots)
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // 🚨 核心修正：將畫布順時針旋轉 90 度，實現橫向排版 (Landscape)
        ctx.save();
        ctx.translate(canvas.width, 0); 
        ctx.rotate(90 * Math.PI / 180); 

        // 📐 旋轉後的邏輯座標系：X 軸 400 (長度), Y 軸 320 (寬度)
        const LOGICAL_WIDTH = 400;
        const LOGICAL_HEIGHT = 320;

        // 填滿白底，清除雜訊
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';

        // --- 繪製版面 ---
        ctx.textAlign = 'left';
        ctx.font = '22px sans-serif'; 
        ctx.fillText(`員工: ${printData.empName}`, 15, 15);
        ctx.font = '24px sans-serif'; 
        ctx.fillText(`${printData.mfdPrint}`, 15, 50); 

        ctx.font = 'bold 46px sans-serif'; 
        ctx.fillText(printData.itemName, 15, 110);

        ctx.textAlign = 'right'; 
        ctx.font = '26px sans-serif';
        ctx.fillText(printData.category, LOGICAL_WIDTH - 15, 125); 

        ctx.textAlign = 'center'; 
        ctx.font = 'bold 42px sans-serif'; 
        ctx.fillText(printData.exdLine1, LOGICAL_WIDTH / 2, 200);
        ctx.fillText(printData.exdLine2, LOGICAL_WIDTH / 2, 250);

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
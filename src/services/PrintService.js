// src/services/PrintService.js

class PrintService {
    /**
     * 策略模式入口：根據指定語言動態產出列印指令
     */
    generateCommand(lang, printData, qty) {
        if (lang === 'EZPL') {
            return this.generateEZPL(printData, qty);
        }
        // 預設為 TSPL
        return this.generateTSPL(printData, qty);
    }

    /**
     * TSPL 列印指令 (0 度橫式標準版)
     */
    generateTSPL(printData, qty) {
        return `
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
    }

    /**
     * EZPL 列印指令 ( Godex 語言 )
     * ⚠️ 針對直出 4x5cm 紙張，進行 90 度字體旋轉的鷹架 (rotation = 1)
     */
    generateEZPL(printData, qty) {
        return `
^Q40,3
^W50
^H10
^P${qty}
^S2
^AT,280,20,24,24,1,1,員工: ${printData.empName}
^AT,230,20,24,24,1,1,${printData.mfdPrint}
^AT,140,20,48,48,1,1,${printData.itemName}
^AT,140,260,24,24,1,1,${printData.category}
^AT,70,40,24,24,1,1,${printData.exdLine1}
^AT,20,140,24,24,1,1,${printData.exdLine2}
^E
        `.trim();
    }

    /**
     * 發送列印指令到中介層
     * @param {string} middlewareIp - 中介電腦 IP
     * @param {string} printerIp - 目標印表機 IP
     * @param {string} command - 產出完成的 TSPL/EZPL 字串
     */
    async sendPrintJob(middlewareIp, printerIp, command) {
        // 動態組合各門市的 API URL，取代原本寫死的 localhost
        const apiUrl = `http://${middlewareIp}:3000/api/print`; 

        try {
            console.log(`[PrintService] 準備傳送列印任務至印表機: ${printerIp}，經由中介層: ${middlewareIp}`);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 配合 server.js 的安全驗證
                    'x-api-key': 'YOUR_SUPER_SECRET_KEY_2026' 
                },
                body: JSON.stringify({
                    printerIp: printerIp,
                    printCommand: command // 變數更名以符合中介層廣義設定
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '中介層發生未知錯誤');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[PrintService Error] 網路或中介層連線失敗:', error.message);
            throw error; 
        }
    }
}

export const printService = new PrintService();
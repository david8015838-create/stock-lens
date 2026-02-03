
const fetch = require('node-fetch'); // You might need to install this or use built-in if node 18+

async function handler() {
  const rawInput = "00865B";
  
  // 2. 自動補全邏輯與格式化
  const tickers = rawInput.split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0)
    .map(sym => {
      if (sym.includes('.')) return sym;
      // 台股代碼自動補全 (同時嘗試 .TW 和 .TWO 以覆蓋上市與上櫃)
      if (/^\d/.test(sym) || (sym.length >= 4 && /\d/.test(sym))) {
        return [`${sym}.TW`, `${sym}.TWO`];
      }
      return sym;
    });

  const processedSymbols = tickers.join(',');
  console.log('Processed Symbols:', processedSymbols);

  try {
    // 3. Yahoo Finance 請求 - 隨機化
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];

    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(processedSymbols)}`;
    console.log('Fetching URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgents[0],
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      }
    });

    console.log('Response Status:', response.status);
    
    if (!response.ok) {
        console.log('Error Body:', await response.text());
        return;
    }

    const data = await response.json();
    const resultArr = data?.quoteResponse?.result || [];

    const results = resultArr.map(item => ({
      symbol: item.symbol,
      price: item.regularMarketPrice,
      change: item.regularMarketChangePercent,
      name: item.shortName || item.longName
    }));

    console.log('Results:', JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('API Error:', error.message);
  }
}

handler();

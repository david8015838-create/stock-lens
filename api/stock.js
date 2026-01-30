export default async function handler(req, res) {
  // 1. 嚴格 Header 緩存控制
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { symbols, ticker, symbol } = req.query;
  const rawInput = symbols || ticker || symbol;

  if (!rawInput) {
    return res.status(200).json({ results: [], error: 'No symbols provided' });
  }

  // 2. 自動補全邏輯與格式化
  const tickers = rawInput.split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0)
    .map(sym => {
      if (sym.includes('.')) return sym;
      // 台股代碼自動補全 .TW (支援純數字 2330 或 數字+L 如 00631L)
      if (/^\d/.test(sym) || (sym.length >= 4 && /\d/.test(sym))) {
        return `${sym}.TW`;
      }
      return sym;
    });

  const processedSymbols = tickers.join(',');

  try {
    // 3. Yahoo Finance 請求 - 隨機化
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    ];

    const versions = ['v6', 'v7', 'v8'];
    const randomVersion = versions[Math.floor(Math.random() * versions.length)];
    const randomBuster = Math.random().toString(36).substring(7);
    
    // 優先使用 query2，它是目前最穩定的
    const url = `https://query2.finance.yahoo.com/${randomVersion}/finance/quote?symbols=${encodeURIComponent(processedSymbols)}&_cachebuster=${randomBuster}&t=${Date.now()}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      }
    });

    // 即便 Yahoo 回傳 429 或其他錯誤，我們也要捕捉並以 200 回傳，讓前端啟動 Fallback
    if (!response.ok) {
      return res.status(200).json({ 
        results: [], 
        error: `Yahoo API returned ${response.status}`,
        status: response.status 
      });
    }

    const data = await response.json();
    const resultArr = data?.quoteResponse?.result || [];

    const results = resultArr.map(item => ({
      symbol: item.symbol,
      price: item.regularMarketPrice,
      change: item.regularMarketChangePercent,
      name: item.shortName || item.longName
    }));

    return res.status(200).json({ results });

  } catch (error) {
    console.error('API Error:', error.message);
    // 致命傷修正：即便崩潰也回傳 200，防止 Vercel 502
    return res.status(200).json({ 
      results: [], 
      error: error.message,
      stack: 'Internal Server Error'
    });
  }
}

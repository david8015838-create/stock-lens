
export default async function handler(req, res) {
  // 1. 嚴格 Header 緩存控制 (Vercel Edge 級別)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 接收 symbols 或 ticker/symbol 參數 (兼容舊版與新版建議)
  const { symbols, ticker, symbol } = req.query;
  const rawInput = symbols || ticker || symbol;

  if (!rawInput) {
    return res.status(400).json({ error: 'Symbols required' });
  }

  // 2. 自動補全邏輯與格式化
  const tickers = rawInput.split(',').map(t => {
    let sym = t.trim().toUpperCase();
    if (sym.includes('.')) return sym;
    // 台股代碼自動補全 .TW (如 2330, 00631L)
    if (/^\d/.test(sym) || (sym.length >= 4 && /\d/.test(sym))) {
      return `${sym}.TW`;
    }
    return sym;
  });

  const processedSymbols = tickers.join(',');

  // 3. Yahoo Finance 批次請求 (優先使用 query2 以避開 401 問題)
  const urls = [
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${processedSymbols}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${processedSymbols}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.quoteResponse?.result?.length > 0) {
          // 簡化數據回傳 (依照建議格式)
          const simplified = data.quoteResponse.result.map(item => ({
            symbol: item.symbol,
            price: item.regularMarketPrice,
            change: item.regularMarketChangePercent,
            name: item.shortName || item.longName,
            currency: item.currency
          }));

          // 為了兼容性，同時保留原始 quoteResponse 結構
          return res.status(200).json({
            results: simplified,
            quoteResponse: data.quoteResponse // 舊代碼可能依賴此結構
          });
        }
      }
    } catch (e) {
      console.error(`Fetch error: ${e.message}`);
    }
  }

  return res.status(502).json({ error: 'All providers failed' });
}

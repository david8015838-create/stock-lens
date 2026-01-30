
export default async function handler(req, res) {
  // 1. 嚴格 Header 緩存控制
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const { symbols, ticker, symbol } = req.query;
    const rawInput = symbols || ticker || symbol;

    if (!rawInput) {
      return res.status(400).json({ error: 'Symbols required' });
    }

    // 2. 自動補全邏輯與格式化，過濾掉空字串
    const tickers = rawInput.split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0)
      .map(sym => {
        if (sym.includes('.')) return sym;
        // 台股代碼自動補全 .TW (如 2330, 00631L)
        if (/^\d/.test(sym) || (sym.length >= 4 && /\d/.test(sym))) {
          return `${sym}.TW`;
        }
        return sym;
      });

    const processedSymbols = tickers.join(',');

    if (!processedSymbols) {
      return res.status(400).json({ error: 'No valid symbols' });
    }

    // 3. Yahoo Finance 批次請求 (多個備用 Endpoint)
    const urls = [
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(processedSymbols)}`,
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(processedSymbols)}`,
      `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(processedSymbols)}`
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://finance.yahoo.com/'
          },
          signal: AbortSignal.timeout(8000) // 增加超時到 8 秒
        });

        if (response.ok) {
          const data = await response.json();
          const resultArr = data?.quoteResponse?.result || [];
          
          if (resultArr.length > 0) {
            const simplified = resultArr.map(item => ({
              symbol: item.symbol,
              price: item.regularMarketPrice,
              change: item.regularMarketChangePercent,
              name: item.shortName || item.longName,
              currency: item.currency
            }));

            return res.status(200).json({
              results: simplified,
              quoteResponse: data.quoteResponse,
              source: url.includes('query2') ? 'query2' : 'query1'
            });
          }
        } else {
          lastError = `Yahoo returned ${response.status} for ${url}`;
        }
      } catch (e) {
        lastError = e.message;
        console.error(`Fetch error for ${url}: ${e.message}`);
      }
    }

    // 如果所有 URL 都失敗
    return res.status(502).json({ 
      error: 'All Yahoo providers failed', 
      details: lastError,
      symbols: processedSymbols 
    });

  } catch (globalError) {
    console.error('Global API Error:', globalError);
    return res.status(500).json({ error: 'Internal Server Error', message: globalError.message });
  }
}

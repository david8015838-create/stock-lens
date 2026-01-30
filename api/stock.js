
export default async function handler(req, res) {
  const { symbol, type } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  // 根據請求類型決定 URL
  let urls = [];
  const isBatch = symbol.includes(',');
  
  if (type === 'chart' && !isBatch) {
    // Chart API
    urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`
    ];
  } else if (type === 'quoteSummary') {
    // V10 QuoteSummary API (美股備援極佳)
    urls = [
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`,
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`
    ];
  } else {
    // Quote API
    urls = [
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
      `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${symbol}`
    ];
  }

  // 模擬真實瀏覽器標頭
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com'
  };

  // 設置超時，避免 Vercel Function 整個超時
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 增加到 8 秒，因為 Yahoo 有時響應較慢

  try {
    // 使用 Promise.any 同時請求 query1 和 query2，誰快就用誰
    const data = await Promise.any(urls.map(async (url) => {
      const response = await fetch(url, { 
        headers,
        signal: controller.signal
      });

      if (response.ok) {
        const json = await response.json();
        // 驗證資料有效性
        if (type === 'chart' && !isBatch) {
          if (json?.chart?.result?.[0]) return json;
        } else if (type === 'quoteSummary') {
          if (json?.quoteSummary?.result?.[0]?.price) return json;
        } else {
          // Quote API 即使代號錯誤也會回傳 200，但 result 會是空的
          if (json?.quoteResponse?.result && json.quoteResponse.result.length > 0) return json;
        }
      }
      throw new Error(`Fetch failed for ${url}`);
    }));

    // 增加快取控制，緩解 Yahoo 頻率限制
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    clearTimeout(timeoutId);
    return res.status(200).json(data);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`All Yahoo requests failed or timed out:`, error);
    return res.status(502).json({ error: 'All upstream providers failed' });
  }
}

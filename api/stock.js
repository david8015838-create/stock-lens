
export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  // 定義多重備援路徑
  const urls = [
    { url: `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`, type: 'chart' },
    { url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`, type: 'chart' },
    { url: `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`, type: 'quote' },
    { url: `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`, type: 'quote' },
    { url: `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`, type: 'quoteSummary' }
  ];

  const headers = {
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  for (const item of urls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 每個請求給 4 秒

    try {
      const response = await fetch(item.url, { headers, signal: controller.signal });
      if (response.ok) {
        const json = await response.json();
        // 驗證資料有效性
        if (item.type === 'chart' && json?.chart?.result?.[0]?.meta?.regularMarketPrice) {
          return res.status(200).json(json);
        }
        if (item.type === 'quote' && json?.quoteResponse?.result?.[0]?.regularMarketPrice) {
          return res.status(200).json(json);
        }
        if (item.type === 'quoteSummary' && json?.quoteSummary?.result?.[0]?.price?.regularMarketPrice) {
          return res.status(200).json(json);
        }
      }
    } catch (e) {
      console.error(`Provider failed: ${item.url}`, e.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  return res.status(502).json({ error: 'All Yahoo providers failed for ' + symbol });
}

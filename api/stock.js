
export default async function handler(req, res) {
  const { symbol, type } = req.query;
  
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });

  // 簡化 URL 構造，優先使用最穩定的 query2
  let urls = [];
  if (type === 'chart') {
    urls = [
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`
    ];
  } else if (type === 'quoteSummary') {
    urls = [
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`,
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`
    ];
  } else {
    urls = [
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
    ];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // 循序嘗試，避免並發導致的集體被封
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': '*/*',
            'User-Agent': 'PostmanRuntime/7.32.3' // 使用較通用的 UA
          },
          signal: controller.signal
        });

        if (response.ok) {
          const json = await response.json();
          // 基礎驗證
          if (type === 'chart' && json?.chart?.result?.[0]) return res.status(200).json(json);
          if (type === 'quoteSummary' && json?.quoteSummary?.result?.[0]) return res.status(200).json(json);
          if (json?.quoteResponse?.result?.length > 0) return res.status(200).json(json);
        }
      } catch (e) {
        console.error(`Failed: ${url}`, e.message);
      }
    }
    
    throw new Error('All providers failed');
  } catch (error) {
    clearTimeout(timeoutId);
    return res.status(502).json({ error: 'Fetch failed', details: error.message });
  } finally {
    clearTimeout(timeoutId);
  }
}

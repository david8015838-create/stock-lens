
export default async function handler(req, res) {
  const { symbol, type } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  // 根據請求類型決定 URL
  // type='chart' 用於獲取單個代碼的詳細圖表/價格數據 (更穩定)
  // type='quote' (預設) 用於獲取多個代碼的價格 (支援逗號分隔)
  let urls = [];
  if (type === 'chart') {
    urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`
    ];
  } else {
    urls = [
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
    ];
  }

  // 設置更真實的 User-Agent
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/'
  };

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        // 增加快取控制，避免過度請求，但保持數據新鮮 (快取 10 秒)
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=59');
        return res.status(200).json(data);
      } else if (response.status === 429) {
        console.warn(`Yahoo rate limited (429) for ${url}`);
        continue; // 嘗試下一個 URL
      }
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
    }
  }

  return res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
}

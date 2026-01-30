
export default async function handler(req, res) {
  const { symbol, type } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  // 根據請求類型決定 URL
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

  // 模擬真實瀏覽器標頭
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com'
  };

  // 設置較短的超時，避免 Vercel Function 整個超時
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5秒超時

  for (const url of urls) {
    try {
      const response = await fetch(url, { 
        headers,
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        // 增加快取控制，緩解 Yahoo 頻率限制
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
        clearTimeout(timeoutId);
        return res.status(200).json(data);
      } else if (response.status === 429) {
        console.warn(`Yahoo rate limited (429) for ${url}`);
        // 繼續嘗試下一個 URL
      } else {
        console.warn(`Yahoo returned ${response.status} for ${url}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`Fetch timeout for ${url}`);
      } else {
        console.error(`Error fetching from ${url}:`, error);
      }
    }
  }

  clearTimeout(timeoutId);
  return res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
}

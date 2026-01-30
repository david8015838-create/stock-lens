
export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
  ];

  // Try both query1 and query2
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error);
    }
  }

  return res.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
}

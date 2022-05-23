
let ethPrice = undefined;
let lastFetched = undefined;

export default async function handler(req, res) {
    if (lastFetched && lastFetched > Date.now() - 10 * 60 * 1000) {
        res.status(200).json({ ethPrice: ethPrice });
        return;
    }

    const queryParams = {
        convert: "USD",
        symbol: "ETH",
    }
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?${queryString}`;
    const headers = {
        "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY
    }
    const result = await fetch(url, { headers: headers });
    const coinMarketCapResponse = await result.json();
    lastFetched = Date.now();
    ethPrice = coinMarketCapResponse.data.ETH.quote.USD.price;
    res.status(200).json({ ethPrice: ethPrice });
}
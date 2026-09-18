import {
  getIndices, getUsMacro, getIndiaMacro, getCurrencies,
  getCommodities, getNews, getSessionClock, computeRiskAppetite
} from '../server/feeds.js';

// Vercel Serverless Function — same payload as the local Express route
// in server/index.js, since app.listen() never runs on Vercel.
export default async function handler(_req, res) {
  const [indices, usMacro, currencies, commodities, news] = await Promise.all([
    getIndices(), getUsMacro(), getCurrencies(), getCommodities(), getNews()
  ]);
  const indiaMacro = getIndiaMacro();

  res.json({
    generatedAt: new Date().toISOString(),
    clock: getSessionClock(),
    risk: computeRiskAppetite({ indices, commodities, indiaMacro, usMacro }),
    indices, usMacro, indiaMacro, currencies, commodities, news
  });
}

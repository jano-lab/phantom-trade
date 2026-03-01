import { NextRequest, NextResponse } from "next/server";
import { getFinnhubNews, getMarketNews, getSentimentAnalysis } from "@/lib/api/news";
import { getSetting } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const ticker    = req.nextUrl.searchParams.get("ticker") ?? "";
  const sentiment = req.nextUrl.searchParams.get("sentiment") === "1";
  const apiKey    = await getSetting("finnhub_key");
  const newsKey   = await getSetting("newsapi_key");

  if (sentiment && ticker) {
    const data = await getSentimentAnalysis(ticker.toUpperCase(), apiKey);
    return NextResponse.json(data);
  }

  if (ticker) {
    const news = await getFinnhubNews(ticker.toUpperCase(), apiKey);
    return NextResponse.json(news);
  }

  const query = req.nextUrl.searchParams.get("q") ?? "stock market";
  const news  = await getMarketNews(query, newsKey);
  return NextResponse.json(news);
}

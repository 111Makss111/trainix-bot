import { NextRequest, NextResponse } from "next/server";
import { getWeeklyCryptoZones, type CryptoMarketType } from "@/lib/crypto-zones";

export const runtime = "nodejs";

function isMarketType(value: string): value is CryptoMarketType {
  return value === "spot" || value === "futures";
}

export async function GET(request: NextRequest) {
  const marketType = request.nextUrl.searchParams.get("marketType")?.trim() ?? "spot";
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? "";

  if (!isMarketType(marketType)) {
    return NextResponse.json(
      {
        error: "Unsupported market type",
      },
      {
        status: 400,
      },
    );
  }

  if (!/^[A-Z0-9]{6,20}$/.test(symbol)) {
    return NextResponse.json(
      {
        error: "Invalid symbol",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const payload = await getWeeklyCryptoZones({
      marketType,
      symbol,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load weekly crypto zones", error);

    return NextResponse.json(
      {
        error: "Failed to build weekly zones",
      },
      {
        status: 500,
      },
    );
  }
}

import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ status: "ok", build: "B1" }, { headers: { "Cache-Control": "no-store" } }); }

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
    console.log("🔴 GlitchTip Test Route Called");
    console.log("SENTRY_DSN:", process.env.SENTRY_DSN);
    console.log("NEXT_PUBLIC_SENTRY_DSN:", process.env.NEXT_PUBLIC_SENTRY_DSN);

    try {
        throw new Error("GlitchTip Test Error - " + new Date().toISOString());
    } catch (e) {
        console.error("🔴 Capturing error with Sentry...", e);
        Sentry.captureException(e);

        return NextResponse.json({
            success: true,
            message: "Error captured and sent to GlitchTip!",
            dsn: process.env.SENTRY_DSN
        });
    }
}

export async function POST() {
    return GET();
}

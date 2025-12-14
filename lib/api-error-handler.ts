// Global API Error Handler Wrapper
// Bu dosya tüm API route'larında hataları otomatik yakalamak için kullanılır

import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

type ApiHandler = (
    request: NextRequest,
    context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * API route'ları için global error handler wrapper
 * Kullanım:
 * export const GET = withErrorHandler(async (request) => {
 *   // your code
 * });
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
    return async (request: NextRequest, context?: any) => {
        try {
            return await handler(request, context);
        } catch (error) {
            // Hatayı GlitchTip'e gönder
            console.error("[API Error]", error);

            Sentry.captureException(error, {
                extra: {
                    url: request.url,
                    method: request.method,
                    headers: Object.fromEntries(request.headers.entries()),
                },
            });

            // Error response döndür
            const message = error instanceof Error ? error.message : "An error occurred";

            return NextResponse.json(
                {
                    error: true,
                    message,
                    timestamp: new Date().toISOString()
                },
                { status: 500 }
            );
        }
    };
}

/**
 * Herhangi bir hatayı GlitchTip'e göndermek için yardımcı fonksiyon
 */
export function captureError(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, { extra: context });
}

/**
 * Mesaj olarak log göndermek için
 */
export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    Sentry.captureMessage(message, level);
}

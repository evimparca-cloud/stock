import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        let botToken = process.env.TELEGRAM_BOT_TOKEN;
        let chatId = process.env.TELEGRAM_CHAT_ID;

        // Try to load from settings file first (overrides env if present)
        try {
            const settingsPath = path.join(process.cwd(), 'data', 'notification-settings.json');
            const data = await fs.readFile(settingsPath, 'utf-8');
            const settings = JSON.parse(data);

            // Only use if valid and not masked
            if (settings.telegram?.botToken && settings.telegram.botToken !== '••••••••' && settings.telegram.botToken.trim() !== '') {
                botToken = settings.telegram.botToken;
            }
            if (settings.telegram?.chatId && settings.telegram.chatId.trim() !== '') {
                chatId = settings.telegram.chatId;
            }
        } catch (e) {
            // File not found or error reading, fallback to env
            console.log('Settings file check skipped:', e);
        }

        if (!botToken || !chatId) {
            return NextResponse.json({
                success: false,
                connected: false,
                error: 'Bot token veya Chat ID eksik (Ayarlardan giriniz)',
            });
        }

        // Check Bot Info
        const botResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const botData = await botResponse.json();

        if (!botData.ok) {
            return NextResponse.json({
                success: false,
                connected: false,
                error: 'Bot token geçersiz (Telegram API reddetti)',
            });
        }

        // Check Chat Permission (by getting chat info)
        const chatResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
        const chatData = await chatResponse.json();

        if (!chatData.ok) {
            return NextResponse.json({
                success: true,
                connected: false,
                botName: botData.result.first_name,
                username: botData.result.username,
                error: `Bot sohbete erişemiyor (Hata: ${chatData.description || 'Bilinmeyen'}). Botu gruba ekleyip yönetici yapın.`,
            });
        }

        return NextResponse.json({
            success: true,
            connected: true,
            botName: botData.result.first_name,
            username: botData.result.username,
            chatType: chatData.result.type,
            chatTitle: chatData.result.title || chatData.result.first_name,
        });

    } catch (error) {
        console.error('Telegram status check error:', error);
        return NextResponse.json({
            success: false,
            connected: false,
            error: 'Sunucu bağlantı hatası',
        });
    }
}

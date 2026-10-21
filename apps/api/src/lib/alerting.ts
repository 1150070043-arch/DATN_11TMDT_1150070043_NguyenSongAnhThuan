import { config } from "../config.js";
import { logger } from "./logger.js";
import { diagnosticErrorCode } from "./diagnostics.js";

export type AlertLevel = "info" | "warning" | "critical";
export type AlertEvent = { level: AlertLevel; type: string; message: string; details?: Record<string, unknown>; timestamp?: string };
export type AlertDelivery = { status: "disabled" | "throttled" | "delivered" | "partial" | "failed"; delivered: string[]; failed: string[]; suppressed: string[] };
type Settings = { webhookUrl?: string | undefined; telegramBotToken?: string | undefined; telegramChatId?: string | undefined; throttleSeconds: number; maxAttempts: number; retryDelayMs: number; timeoutMs: number };

export function createAlertDispatcher(settings: Settings, dependencies: {
  fetch?: typeof fetch; now?: () => number; wait?: (ms: number) => Promise<void>;
  log?: (event: string, data: Record<string, unknown>) => void;
} = {}) {
  const request = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = dependencies.log ?? ((event, data) => logger.error(event, data));
  const records = new Map<string, { sentAt?: number; suppressed: number; busy: boolean }>();
  return async (event: AlertEvent): Promise<AlertDelivery> => {
    const channels: { name: string; url: string; payload: (text: string) => unknown; telegram?: boolean }[] = [];
    if (settings.telegramBotToken && settings.telegramChatId) channels.push({ name: "telegram", telegram: true,
      url: `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      payload: text => ({ chat_id: settings.telegramChatId, text, disable_web_page_preview: true }) });
    if (settings.webhookUrl) {
      const hostname = new URL(settings.webhookUrl).hostname;
      channels.push({ name: "webhook", url: settings.webhookUrl, payload: text => hostname === "discord.com" || hostname === "discordapp.com"
        ? { content: text.slice(0, 1900) } : hostname === "hooks.slack.com" ? { text } : { text, alert: event, mode: config.mode, environment: config.nodeEnv } });
    }
    if (!channels.length) return { status: "disabled", delivered: [], failed: [], suppressed: [] };
    const delivered: string[] = [], failed: string[] = [], suppressed: string[] = [];
    await Promise.all(channels.map(async channel => {
      const key = `${channel.name}:${event.level}:${event.type}`;
      const record = records.get(key) ?? { suppressed: 0, busy: false };
      records.set(key, record);
      if (record.busy || (record.sentAt !== undefined && now() - record.sentAt < settings.throttleSeconds * 1000)) {
        record.suppressed++; suppressed.push(channel.name); return;
      }
      record.busy = true;
      const previousSuppressed = record.suppressed;
      const text = [ `[BookGuard ${event.level.toUpperCase()}] ${event.type}`, `Environment: ${config.mode} (${config.nodeEnv})`,
        `Time: ${event.timestamp ?? new Date().toISOString()}`, event.message,
        previousSuppressed ? `Suppressed similar events: ${previousSuppressed}` : "",
        event.details ? JSON.stringify(event.details) : "" ].filter(Boolean).join("\n").slice(0, 3500);
      try {
        for (let attempt = 1; attempt <= settings.maxAttempts; attempt++) {
          try {
            const response = await request(channel.url, { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(channel.payload(text)), signal: AbortSignal.timeout(settings.timeoutMs) });
            const ok = response.ok && (!channel.telegram || (await response.json() as { ok?: boolean }).ok === true);
            await response.body?.cancel().catch(() => undefined);
            if (ok) { record.sentAt = now(); record.suppressed -= previousSuppressed; delivered.push(channel.name); return; }
            const retryable = response.status === 429 || response.status >= 500;
            log("alert_channel_failed", { channel: channel.name, type: event.type, attempt, status: response.status });
            if (!retryable || attempt === settings.maxAttempts) break;
          } catch (error) {
            log("alert_channel_failed", { channel: channel.name, type: event.type, attempt, code: diagnosticErrorCode(error) });
            if (attempt === settings.maxAttempts) break;
          }
          await wait(settings.retryDelayMs * 2 ** (attempt - 1));
        }
        failed.push(channel.name);
      } finally { record.busy = false; }
    }));
    if (records.size > 2000) for (const [oldKey, old] of records) {
      if (!old.busy && (old.sentAt === undefined || now() - old.sentAt >= settings.throttleSeconds * 1000)) records.delete(oldKey);
      if (records.size <= 1000) break;
    }
    return { status: failed.length ? (delivered.length ? "partial" : "failed") : delivered.length ? "delivered" : "throttled", delivered, failed, suppressed };
  };
}

export const deliverAlert = createAlertDispatcher(config.alerting);
export async function sendAlert(event: AlertEvent): Promise<boolean> { return (await deliverAlert(event)).status === "delivered"; }
export function sendAlertNonBlocking(event: AlertEvent): void {
  void deliverAlert(event).catch(error => logger.error("alert_dispatch_unexpected_error", { code: diagnosticErrorCode(error) }));
}

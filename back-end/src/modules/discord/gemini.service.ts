/**
 * modules/discord/gemini.service.ts
 *
 * Wraps the Google Gemini SDK. When `GEMINI_API_KEY` is unset or the API
 * call fails, the wrapper throws — callers fall back to rule-based replies.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import type { GeminiContext } from './discord.types.js';

const SYSTEM_PROMPT = [
  'You are a friendly office assistant monitoring lights, fans and power use.',
  'You will receive a JSON snapshot of the current office state plus the user\'s question.',
  'Summarise the state naturally, mention active rooms, mention alerts, mention power.',
  'Use emojis sparingly. Keep responses under 120 words.',
  'Do not invent values that are not in the JSON snapshot.',
].join(' ');

class GeminiService {
  private client: GoogleGenerativeAI | null = null;

  /** Lazily initialise to avoid costing startup time when not configured. */
  private getClient(): GoogleGenerativeAI | null {
    if (!config.gemini.enabled) return null;
    if (!this.client) {
      this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    }
    return this.client;
  }

  /**
   * Generate a humanised reply from raw office data.
   * Throws on any failure so the caller can fall back.
   */
  async humanize(ctx: GeminiContext): Promise<string> {
    const client = this.getClient();
    if (!client) throw new Error('Gemini not configured');

    const model = client.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: SYSTEM_PROMPT,
    });

    const userPayload = [
      'Office snapshot:',
      '```json',
      JSON.stringify(ctx.snapshot, null, 2),
      '```',
      `Question: ${ctx.question}`,
    ].join('\n');

    const res = await model.generateContent(userPayload);
    console.log('Gemini response:', res.response.text());
    const text = res.response.text().trim();
    if (!text) throw new Error('Gemini returned empty text');
    return text;
  }
}

export const geminiService = new GeminiService();

/* -------------------------------------------------------------------------- */
/* Rule-based fallback                                                       */
/* -------------------------------------------------------------------------- */

import { DeviceStatus, DeviceType, Room, ROOM_LABELS } from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import type { Alert } from '../../interfaces/alert.interface.js';
import type { HumanReply } from './discord.types.js';

/** Group devices into a stable, bot-friendly snapshot. */
export const buildSnapshot = (
  devices: Device[],
  alerts: Alert[],
  usage: { totalPowerWatts: number; estimatedTodayKWh: number }
) => {
  const byRoom: Record<string, { fansOn: number; fansOff: number; lightsOn: number; lightsOff: number; devices: { name: string; status: string }[] }> = {};
  for (const r of Object.values(Room)) {
    byRoom[ROOM_LABELS[r as Room]] = { fansOn: 0, fansOff: 0, lightsOn: 0, lightsOff: 0, devices: [] };
  }
  for (const d of devices) {
    const room = ROOM_LABELS[d.room];
    const bucket = byRoom[room];
    if (!bucket) continue;
    if (d.type === DeviceType.FAN) {
      d.status === DeviceStatus.ON ? bucket.fansOn++ : bucket.fansOff++;
    } else {
      d.status === DeviceStatus.ON ? bucket.lightsOn++ : bucket.lightsOff++;
    }
    bucket.devices.push({ name: d.name, status: d.status });
  }
  return {
    rooms: byRoom,
    powerWatts: usage.totalPowerWatts,
    todayKWh: usage.estimatedTodayKWh,
    activeAlerts: alerts.map((a) => ({ type: a.type, title: a.title })),
  };
};

/**
 * Pure rule-based reply generator — used when Gemini is disabled or fails.
 * Returns a friendly sentence per recognised question.
 */
export const ruleBasedReply = (
  questionRaw: string,
  devices: Device[],
  alerts: Alert[],
  usage: { totalPowerWatts: number; estimatedTodayKWh: number }
): HumanReply => {
  const question = questionRaw.toLowerCase().trim();

  // Try !room <name>
  const roomArg = question.replace(/^!room\s+/, '').trim();
  if (question.startsWith('!room')) {
    const matched = Object.values(Room).find(
      (r) => roomArg === r || ROOM_LABELS[r as Room].toLowerCase() === roomArg
    );
    if (!matched) {
      return {
        source: 'rule-based',
        text: "Hmm, I don't know that room. Try `!room drawing`, `!room work1`, or `!room work2`.",
      };
    }
    const list = devices.filter((d) => d.room === matched);
    const on = list.filter((d) => d.status === DeviceStatus.ON);
    if (on.length === 0) {
      return {
        source: 'rule-based',
        text: `🟢 ${ROOM_LABELS[matched]} is fully OFF right now. Looking good!`,
      };
    }
    const names = on.map((d) => d.name).join(', ');
    return {
      source: 'rule-based',
      text: `${ROOM_LABELS[matched]} currently has ON: ${names}. The rest are off.`,
    };
  }

  // !usage
  if (question.startsWith('!usage')) {
    return {
      source: 'rule-based',
      text: `⚡ Total power right now: **${usage.totalPowerWatts} W**. Today's estimated usage: **${usage.estimatedTodayKWh} kWh**.`,
    };
  }

  // !status (default)
  const grouped = devices.reduce<Record<string, { fansOn: number; lightsOn: number }>>(
    (acc, d) => {
      const room = ROOM_LABELS[d.room];
      if (!acc[room]) acc[room] = { fansOn: 0, lightsOn: 0 };
      if (d.status === DeviceStatus.ON) {
        if (d.type === DeviceType.FAN) acc[room].fansOn++;
        else acc[room].lightsOn++;
      }
      return acc;
    },
    {}
  );

  const summary = Object.entries(grouped)
    .map(([room, counts]) => {
      const parts: string[] = [];
      if (counts.fansOn > 0) parts.push(`${counts.fansOn} fan${counts.fansOn > 1 ? 's' : ''} ON`);
      if (counts.lightsOn > 0) parts.push(`${counts.lightsOn} light${counts.lightsOn > 1 ? 's' : ''} ON`);
      if (parts.length === 0) parts.push('all off');
      return `${room}: ${parts.join(', ')}`;
    })
    .join(' · ');

  const alertLine =
    alerts.length === 0
      ? '✅ No active alerts.'
      : `⚠ Active alerts: ${alerts.length} (${alerts
          .slice(0, 3)
          .map((a) => a.title)
          .join('; ')})`;

  return {
    source: 'rule-based',
    text: `📊 **Office status**\n${summary}\n⚡ Power: **${usage.totalPowerWatts} W** · Today: **${usage.estimatedTodayKWh} kWh**\n${alertLine}`,
  };
};

void logger; // keep logger import alive for upcoming debug logs
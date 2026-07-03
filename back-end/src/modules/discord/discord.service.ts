/**
 * modules/discord/discord.service.ts
 *
 * Manages the discord.js client and the alert-channel poster.
 *
 * Commands:
 *   !status   → overall office snapshot
 *   !room drawing|work1|work2  → status of a single room
 *   !usage    → current power draw + today's kWh
 *
 * Replies are humanised via Gemini (if configured) with a rule-based fallback.
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
  type TextChannel,
} from 'discord.js';

import { config } from '../../config/config.js';
import { databaseService } from '../../database/database.service.js';
import { logger } from '../../utils/logger.js';
import { Room, ROOM_LABELS } from '../../types/enums.js';
import type { Alert } from '../../interfaces/alert.interface.js';
import { buildOfficeUsage } from '../usage/usage.service.js';
import {
  buildSnapshot,
  geminiService,
  ruleBasedReply,
} from './gemini.service.js';

/**
 * Format a friendly, alert-only message to drop into the configured channel.
 */
const formatAlertMessage = (a: Alert): string => {
  const icon = a.type === 'AFTER_HOURS' ? '⏰' : '⏱';
  return [
    `${icon} **${a.title}**`,
    a.message,
    `_Triggered at ${new Date(a.triggeredAt).toLocaleString()}_`,
  ].join('\n');
};

class DiscordService {
  private client: Client | null = null;
  private ready = false;

  isEnabled(): boolean {
    return config.discord.enabled;
  }

  async init(): Promise<void> {
    if (!config.discord.enabled) {
      logger.warn('discord', 'DISCORD_TOKEN missing — bot disabled');
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.client.once(Events.ClientReady, (c) => {
      this.ready = true;
      logger.info('discord', `logged in as ${c.user.tag}`);
    });

    this.client.on(Events.MessageCreate, (msg) => this.handleMessage(msg));

    this.client.on(Events.Error, (err) => {
      logger.error('discord', 'client error', err);
    });

    try {
      await this.client.login(config.discord.token);
    } catch (err) {
      logger.error('discord', 'login failed', err);
    }
  }

  /**
   * Public hook used by the alert engine. No-op if bot is not ready.
   */
  async notifyAlert(alert: Alert): Promise<void> {
    if (!this.client || !this.ready) return;
    const channelId = config.discord.alertChannelId;
    if (!channelId) return;
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        await (channel as TextChannel).send({ content: formatAlertMessage(alert) });
      }
    } catch (err) {
      logger.warn('discord', 'failed to post alert', err);
    }
  }

  /** Handle an incoming message — only respond when prefix is '!'. */
  private async handleMessage(msg: Message): Promise<void> {
    if (msg.author.bot) return;
    const content = msg.content.trim();
    if (!content.startsWith('!')) return;

    const command = content.split(/\s+/)[0]?.toLowerCase();
    if (!command) return;
    if (!['!status', '!room', '!usage'].includes(command)) return;

    try {
      const devices = await databaseService.getDevices();
      const alerts = await databaseService.getAlerts();
      const usage = buildOfficeUsage(devices);

      let replyText = '';

      try {
        const snapshot = buildSnapshot(devices, alerts, usage);
        const question = content;

        if (command === '!room') {
          const arg = content.slice('!room'.length).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
          const matched = Object.values(Room).find(
            (r) => arg === r || ROOM_LABELS[r as Room].toLowerCase().split(' ').join('').toLowerCase() === arg.replace(/\s+/g, '')
          );
          if (matched) {
            const list = devices.filter((d) => d.room === matched);
            const on = list.filter((d) => d.status === 'ON').map((d) => d.name);
            const text = on.length === 0 ? `${ROOM_LABELS[matched]} is all OFF.` : `${ROOM_LABELS[matched]} has ON: ${on.join(', ')}.`;
            await msg.reply({ content: text });
            return;
          }
        }

        // Default Gemini path for friendly responses.
        const text = await geminiService.humanize({ question, snapshot });
        replyText = text;
      } catch (llmErr) {
        // Fall back to rule-based reply.
        const fallback = ruleBasedReply(content, devices, alerts, usage);
        logger.warn('discord', 'Gemini fallback engaged', llmErr);
        replyText = fallback.text;
      }

      await msg.reply({ content: replyText });
    } catch (err) {
      logger.error('discord', 'message handler failed', err);
      await msg.reply({ content: 'Something went wrong fetching office data.' });
    }
  }
}

export const discordService = new DiscordService();
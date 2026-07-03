/**
 * modules/discord/discord.types.ts
 *
 * Inputs / outputs the Gemini humanizer accepts and emits.
 */

export interface GeminiContext {
  /** Generated question from the user (chat history trimmed). */
  question: string;
  /** A short JSON snapshot of current office state. */
  snapshot: Record<string, unknown>;
}

export interface HumanReply {
  /** Final text reply (either LLM-generated or rule-based fallback). */
  text: string;
  /** Where the reply came from — useful in logs. */
  source: 'gemini' | 'rule-based';
}

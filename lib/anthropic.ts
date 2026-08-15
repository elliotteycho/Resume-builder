import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    try {
      _client = new Anthropic();
    } catch {
      // The SDK's own message enumerates every credential source it looked at,
      // which is noise for someone who just hasn't set up the app yet.
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key — matching, research, and resume generation all need it."
      );
    }
  }
  return _client;
}

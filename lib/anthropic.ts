import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

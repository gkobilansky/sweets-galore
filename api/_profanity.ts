/**
 * Server-side profanity filter for nickname validation.
 * Checks against common bad words with leetspeak normalization.
 */

const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'slut', 'whore',
  'bastard', 'damn', 'piss', 'crap', 'penis', 'vagina', 'anus',
  'nazi', 'hitler', 'rape', 'molest', 'pedo', 'porn', 'sex',
  'twat', 'wank', 'tits', 'boob', 'dildo', 'jizz', 'cum', 'semen',
  'kike', 'spic', 'chink', 'gook', 'wetback', 'beaner'
];

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '2': 'z'
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  for (const [leet, char] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(char);
  }

  normalized = normalized.replace(/(.)\1+/g, '$1');
  normalized = normalized.replace(/[^a-z]/g, '');

  return normalized;
}

export function containsProfanity(text: string): boolean {
  const normalized = normalizeText(text);
  return BAD_WORDS.some(word => normalized.includes(word));
}

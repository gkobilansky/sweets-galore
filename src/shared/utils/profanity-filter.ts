/**
 * Lightweight profanity filter for nickname validation.
 * Checks against common bad words with leetspeak normalization.
 */

// Common bad words to filter (kept minimal but effective)
const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'slut', 'whore',
  'bastard', 'damn', 'piss', 'crap', 'penis', 'vagina', 'anus',
  'nazi', 'hitler', 'rape', 'molest', 'pedo', 'porn', 'sex',
  'twat', 'wank', 'tits', 'boob', 'dildo', 'jizz', 'cum', 'semen',
  'kike', 'spic', 'chink', 'gook', 'wetback', 'beaner'
];

// Leetspeak character mappings
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

/**
 * Normalizes text by converting leetspeak and removing non-alpha characters
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  // Replace leetspeak characters
  for (const [leet, char] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(char);
  }

  // Remove repeated characters (e.g., "fuuuck" -> "fuck")
  normalized = normalized.replace(/(.)\1+/g, '$1');

  // Remove non-alphabetic characters (spaces, numbers, symbols)
  normalized = normalized.replace(/[^a-z]/g, '');

  return normalized;
}

/**
 * Checks if a string contains profanity
 * @param text The text to check
 * @returns true if profanity is detected, false otherwise
 */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeText(text);

  return BAD_WORDS.some(word => normalized.includes(word));
}

/**
 * Validates a nickname for profanity
 * @param nickname The nickname to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateNickname(nickname: string): { isValid: boolean; error?: string } {
  if (containsProfanity(nickname)) {
    return {
      isValid: false,
      error: 'Please choose a different nickname.'
    };
  }

  return { isValid: true };
}

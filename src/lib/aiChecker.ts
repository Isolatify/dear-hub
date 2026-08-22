import type { AiScore, AiSignal } from '@/types';

// AI text detection based on statistical analysis of writing patterns.
// This is a heuristic-based analyzer, not a trained ML model.
// It examines: sentence length variance (burstiness), vocabulary diversity,
// repetitive phrasing, punctuation patterns, and common AI markers.

const AI_PHRASES = [
  'it is important to note',
  'in conclusion',
  'furthermore',
  'moreover',
  'additionally',
  'it is worth noting',
  'plays a crucial role',
  'in today\'s world',
  'delve into',
  'navigate the complexities',
  'a testament to',
  'on the other hand',
  'in the realm of',
  'tapestry',
  'landscape of',
  'underscores',
  'leverage',
  'seamless',
  'robust',
  'comprehensive',
  'multifaceted',
  'paradigm',
  'holistic',
  'synergy',
  'ever-evolving',
];

export function analyzeText(text: string): AiScore {
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();

  if (cleanText.length < 50) {
    return {
      verdict: 'likely_human',
      ai_probability: 10,
      human_probability: 90,
      signals: [
        {
          label: 'Too short to analyze',
          weight: 'low',
          detail: 'The text is too short for meaningful pattern analysis.',
          points_to: 'human',
        },
      ],
    };
  }

  const signals: AiSignal[] = [];
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = cleanText.toLowerCase().match(/\b\w+\b/g) ?? [];
  const wordCount = words.length;
  const sentenceLengths = sentences.map((s) => (s.trim().match(/\b\w+\b/g) ?? []).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1);

  // 1. Burstiness (sentence length variance)
  const variance = sentenceLengths.length > 1
    ? sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0) / sentenceLengths.length
    : 0;
  const stddev = Math.sqrt(variance);
  const cv = avgSentenceLength > 0 ? stddev / avgSentenceLength : 0;

  if (cv < 0.3 && sentenceLengths.length > 3) {
    signals.push({
      label: 'Low sentence length variation',
      weight: 'high',
      detail: `Sentences are very uniform in length (variation: ${(cv * 100).toFixed(0)}%). Human writing tends to vary sentence length more naturally.`,
      points_to: 'ai',
    });
  } else if (cv > 0.5) {
    signals.push({
      label: 'High sentence length variation',
      weight: 'medium',
      detail: `Sentences vary significantly in length (variation: ${(cv * 100).toFixed(0)}%). This is typical of human writing.`,
      points_to: 'human',
    });
  }

  // 2. Vocabulary diversity (type-token ratio)
  const uniqueWords = new Set(words);
  const ttr = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  if (ttr < 0.35 && wordCount > 100) {
    signals.push({
      label: 'Low vocabulary diversity',
      weight: 'medium',
      detail: `Only ${uniqueWords.size} unique words out of ${wordCount}. AI text often reuses a narrow vocabulary.`,
      points_to: 'ai',
    });
  } else if (ttr > 0.55) {
    signals.push({
      label: 'Rich vocabulary diversity',
      weight: 'medium',
      detail: `${uniqueWords.size} unique words out of ${wordCount}. Diverse vocabulary is common in human writing.`,
      points_to: 'human',
    });
  }

  // 3. AI phrase detection
  const lowerText = cleanText.toLowerCase();
  const foundPhrases = AI_PHRASES.filter((phrase) => lowerText.includes(phrase));

  if (foundPhrases.length >= 3) {
    signals.push({
      label: 'Common AI phrases detected',
      weight: 'high',
      detail: `Found ${foundPhrases.length} phrases commonly used by AI: "${foundPhrases.slice(0, 3).join('", "')}"`,
      points_to: 'ai',
    });
  } else if (foundPhrases.length === 0) {
    signals.push({
      label: 'No common AI phrases',
      weight: 'medium',
      detail: 'No commonly-used AI phrases were detected in the text.',
      points_to: 'human',
    });
  }

  // 4. Punctuation patterns
  const exclamationCount = (cleanText.match(/!/g) ?? []).length;
  const questionCount = (cleanText.match(/\?/g) ?? []).length;
  const semicolonCount = (cleanText.match(/;/g) ?? []).length;
  const dashCount = (cleanText.match(/—|--/g) ?? []).length;

  if (exclamationCount === 0 && questionCount === 0 && wordCount > 200) {
    signals.push({
      label: 'No exclamatory or interrogative sentences',
      weight: 'medium',
      detail: 'The text contains no exclamation marks or question marks. AI tends to write in a purely declarative style.',
      points_to: 'ai',
    });
  }

  if (exclamationCount > 0 || questionCount > 0) {
    signals.push({
      label: 'Expressive punctuation',
      weight: 'low',
      detail: `Found ${exclamationCount} exclamation marks and ${questionCount} question marks. Expressive punctuation is more human.`,
      points_to: 'human',
    });
  }

  // 5. Repetition detection
  const wordFreq = new Map<string, number>();
  words.forEach((w) => {
    if (w.length > 4) {
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  });
  const repeatedWords = Array.from(wordFreq.entries()).filter(([, count]) => count > wordCount * 0.03);

  if (repeatedWords.length > 3) {
    signals.push({
      label: 'Word repetition',
      weight: 'medium',
      detail: `Several words are repeated frequently: ${repeatedWords.slice(0, 3).map(([w, c]) => `"${w}" (${c}x)`).join(', ')}`,
      points_to: 'ai',
    });
  }

  // 6. Average word length (AI tends to use longer words)
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = wordCount > 0 ? totalChars / wordCount : 0;

  if (avgWordLength > 5.5 && wordCount > 100) {
    signals.push({
      label: 'Long average word length',
      weight: 'low',
      detail: `Average word length is ${avgWordLength.toFixed(1)} characters. AI tends to use longer, more formal words.`,
      points_to: 'ai',
    });
  }

  // Calculate final score
  let aiPoints = 0;
  let humanPoints = 0;
  const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };

  signals.forEach((sig) => {
    if (sig.points_to === 'ai') aiPoints += weights[sig.weight];
    else humanPoints += weights[sig.weight];
  });

  const totalPoints = aiPoints + humanPoints || 1;
  const aiProbability = Math.round((aiPoints / totalPoints) * 100);
  const humanProbability = 100 - aiProbability;

  let verdict: AiScore['verdict'] = 'mixed';
  if (aiProbability > 65) verdict = 'likely_ai';
  else if (humanProbability > 65) verdict = 'likely_human';

  return {
    verdict,
    ai_probability: aiProbability,
    human_probability: humanProbability,
    signals,
  };
}

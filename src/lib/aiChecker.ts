import type { AiScore, AiSignal } from '@/types';

const SAPLING_API_KEY = import.meta.env.VITE_SAPLING_API_KEY as string;
const SAPLING_ENDPOINT = 'https://api.sapling.ai/api/v1/aidetect';

// ─── Sapling API Call ──────────────────────────────────────────────
export async function analyzeTextWithSapling(text: string): Promise<AiScore> {
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
          detail: 'The text is too short for meaningful analysis.',
          points_to: 'human',
        },
      ],
    };
  }

  if (!SAPLING_API_KEY) {
    console.warn('Sapling API key not set, falling back to local analysis');
    return analyzeTextLocal(cleanText);
  }

  try {
    const response = await fetch(SAPLING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SAPLING_API_KEY,
        text: cleanText,
        sent_scores: true,
      }),
    });

    if (!response.ok) {
      console.error('Sapling API error:', response.status);
      return analyzeTextLocal(cleanText);
    }

    const data = await response.json();
    const score = data.score as number; // 0-1, higher = more AI
    const sentenceScores = data.sentence_scores as Array<{ score: number; sentence: string }>;

    const aiProbability = Math.round(score * 100);
    const humanProbability = 100 - aiProbability;

    let verdict: AiScore['verdict'] = 'mixed';
    if (aiProbability >= 70) verdict = 'likely_ai';
    else if (humanProbability >= 70) verdict = 'likely_human';

    // Build signals from sentence scores
    const signals: AiSignal[] = [];

    if (sentenceScores && sentenceScores.length > 0) {
      const highAISentences = sentenceScores.filter((s) => s.score >= 0.7);
      const highHumanSentences = sentenceScores.filter((s) => s.score <= 0.3);

      if (highAISentences.length > 0) {
        signals.push({
          label: 'AI-generated sentences detected',
          weight: 'high',
          detail: `${highAISentences.length} of ${sentenceScores.length} sentences flagged as AI-generated. Example: "${highAISentences[0].sentence.slice(0, 80)}..."`,
          points_to: 'ai',
        });
      }

      if (highHumanSentences.length > 0) {
        signals.push({
          label: 'Human-written sentences found',
          weight: 'medium',
          detail: `${highHumanSentences.length} of ${sentenceScores.length} sentences appear human-written.`,
          points_to: 'human',
        });
      }

      // Perplexity signal — consistent low scores across sentences = AI
      const avgScore = sentenceScores.reduce((a, s) => a + s.score, 0) / sentenceScores.length;
      const scoreVariance = sentenceScores.reduce((a, s) => a + Math.pow(s.score - avgScore, 2), 0) / sentenceScores.length;
      const scoreStdDev = Math.sqrt(scoreVariance);

      if (scoreStdDev < 0.15 && sentenceScores.length > 3) {
        signals.push({
          label: 'Uniform sentence-level AI scores',
          weight: 'medium',
          detail: `AI scores are very consistent across sentences (std dev: ${scoreStdDev.toFixed(3)}). This uniformity is typical of fully AI-generated text.`,
          points_to: 'ai',
        });
      }

      if (scoreStdDev > 0.3) {
        signals.push({
          label: 'Mixed AI/human sentence patterns',
          weight: 'medium',
          detail: `AI scores vary significantly (std dev: ${scoreStdDev.toFixed(3)}). This suggests a mix of AI and human writing.`,
          points_to: 'human',
        });
      }
    }

    // Overall confidence signal
    if (aiProbability >= 85) {
      signals.push({
        label: 'High confidence AI detection',
        weight: 'high',
        detail: `Sapling detected AI-generated text with ${aiProbability}% confidence.`,
        points_to: 'ai',
      });
    } else if (humanProbability >= 85) {
      signals.push({
        label: 'High confidence human detection',
        weight: 'high',
        detail: `Sapling detected human-written text with ${humanProbability}% confidence.`,
        points_to: 'human',
      });
    }

    return {
      verdict,
      ai_probability: aiProbability,
      human_probability: humanProbability,
      signals,
    };
  } catch (err) {
    console.error('Sapling API request failed:', err);
    return analyzeTextLocal(cleanText);
  }
}

// ─── Local Heuristic Fallback (used when API is unavailable) ──────
function analyzeTextLocal(text: string): AiScore {
  const AI_PHRASES: [string, number][] = [
    ['it is important to note', 5], ['it is worth noting', 5],
    ['plays a crucial role', 5], ['delve into', 5],
    ['navigate the complexities', 5], ['a testament to', 5],
    ['in the realm of', 5], ['shed light on', 5],
    ['rich tapestry', 5], ['tapestry of', 5],
    ['landscape of', 5], ['ever-evolving', 5],
    ['seamless integration', 5], ['multifaceted approach', 5],
    ['paradigm shift', 5], ['synergy between', 5],
    ['holistic approach', 5], ['leverage the', 5],
    ['robust framework', 5], ['comprehensive understanding', 5],
    ['a myriad of', 5], ['underscores the', 5],
    ['in an era of', 5], ['as we navigate', 5],
    ['it is imperative', 5], ['this essay', 5],
    ['this paper aims', 5], ['in this essay', 5],
    ['to be sure', 5], ['needless to say', 5],
    ['it goes without saying', 5], ['that being said', 5],
    ['with that in mind', 5], ['having said that', 5],
    ['in the grand scheme', 5], ['at the end of the day', 5],
    ['dive deeper into', 5], ['in today\'s digital age', 5],
    ['game-changer', 5], [' unlocking ', 5],
    ['harness the power', 5], ['pave the way', 5],
    ['furthermore, ', 4], ['moreover, ', 4],
    ['additionally, ', 4], ['additionally.', 4],
    ['furthermore.', 4], ['moreover.', 4],
    ['on the other hand', 4], ['conversely', 4],
    ['nevertheless', 4], ['nonetheless', 4],
    ['consequently', 4], ['as a result', 4],
    ['therefore,', 4], ['thus,', 4],
    ['hence,', 4], ['accordingly,', 4],
    ['it can be argued', 4], ['it is evident', 4],
    ['it is clear that', 4], ['it should be noted', 4],
    ['in light of this', 4], ['with this in mind', 4],
    ['in order to', 4], ['for the purpose of', 4],
    ['with regard to', 4], ['in terms of', 4],
    ['with respect to', 4], ['in the context of', 4],
    ['in essence', 4], ['fundamentally', 4],
    ['essentially,', 4], ['ultimately,', 4],
    ['likewise,', 4], ['similarly,', 4],
    ['in summary,', 4], ['to summarize,', 4],
    ['first and foremost', 4], ['last but not least', 4],
    ['pivotal role', 3], ['pivotal moment', 3],
    ['arguably the', 3], ['notably,', 3],
    ['intricate relationship', 3], ['profound impact', 3],
    ['significant impact', 3], ['substantial impact', 3],
    ['nuanced understanding', 3], ['intricacies of', 3],
    ['complexities of', 3], ['plethora of', 3],
    ['foster a sense', 3], ['embrace the', 3],
    ['embark on', 3], ['endeavor to', 3],
    ['facilitate the', 3], ['instrumental in', 3],
    ['paramount importance', 3], ['imperative that', 3],
    ['indispensable', 3], ['unprecedented', 3],
    ['transformative', 3], ['exacerbate', 3],
    ['mitigate the', 3], ['meticulously', 3],
  ];

  const lowerText = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = lowerText.match(/\b\w+\b/g) ?? [];
  const wordCount = words.length;
  const sentenceLengths = sentences.map((s) => (s.trim().match(/\b\w+\b/g) ?? []).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1);

  let aiScore = 0;
  let humanScore = 0;

  // AI phrases
  const foundPhrases = AI_PHRASES.filter(([phrase]) => lowerText.includes(phrase));
  if (foundPhrases.length > 0) {
    aiScore += foundPhrases.reduce((sum, [, w]) => sum + w, 0);
  }

  // Burstiness
  if (sentenceLengths.length > 3) {
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0) / sentenceLengths.length;
    const cv = avgSentenceLength > 0 ? Math.sqrt(variance) / avgSentenceLength : 0;
    if (cv < 0.3) aiScore += 6;
    else if (cv > 0.6) humanScore += 4;
  }

  // Vocabulary diversity
  const uniqueWords = new Set(words);
  const ttr = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  if (ttr < 0.35 && wordCount > 80) aiScore += 5;
  else if (ttr > 0.65 && wordCount > 80) humanScore += 4;

  // Punctuation
  const exclamationCount = (text.match(/!/g) ?? []).length;
  const questionCount = (text.match(/\?/g) ?? []).length;
  if (exclamationCount === 0 && questionCount === 0 && wordCount > 100) aiScore += 4;
  else if (exclamationCount > 2 || questionCount > 1) humanScore += 3;

  // Word length
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = wordCount > 0 ? totalChars / wordCount : 0;
  if (avgWordLength > 5.3 && wordCount > 80) aiScore += 3;

  // Length amplifier
  if (wordCount > 300) {
    const amplifier = Math.min(2, 1 + (wordCount - 300) / 500);
    aiScore = Math.round(aiScore * amplifier);
  }

  const total = aiScore + humanScore || 1;
  const adjustedAI = aiScore * 1.5;
  const adjustedHuman = humanScore * 0.7;
  const adjustedTotal = adjustedAI + adjustedHuman || 1;

  let aiProbability = Math.round((adjustedAI / adjustedTotal) * 100);
  aiProbability = Math.min(99, Math.max(1, aiProbability));
  const humanProbability = 100 - aiProbability;

  let verdict: AiScore['verdict'] = 'mixed';
  if (aiProbability >= 60) verdict = 'likely_ai';
  else if (humanProbability >= 60) verdict = 'likely_human';

  return {
    verdict,
    ai_probability: aiProbability,
    human_probability: humanProbability,
    signals: [{
      label: 'Local heuristic analysis (API unavailable)',
      weight: 'low',
      detail: `Sapling API was unavailable. Used local analysis with ${foundPhrases.length} AI phrases detected.`,
      points_to: verdict === 'likely_ai' ? 'ai' : 'human',
    }],
  };
}

// ─── Backward-compatible sync wrapper (for existing callers) ──────
export function analyzeText(text: string): AiScore {
  // This is kept for backward compatibility but should NOT be used in new code.
  // Use analyzeTextWithSapling() instead.
  return analyzeTextLocal(text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim());
}

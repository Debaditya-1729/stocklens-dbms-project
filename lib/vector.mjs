// Deterministic domain-aware vector embedding engine for StockLens market intelligence.
// Maps financial text into a 64-dimensional vector space using domain concept anchors
// and signed term feature hashing (the Hashing Trick), followed by L2-normalization.
// Designed for exact mathematical compatibility with PostgreSQL pgvector (vector_cosine_ops).

const CONCEPTS = [
  ['tech', ['software', 'cloud', 'ai', 'platform', 'enterprise', 'saas', 'data', 'computing', 'code', 'stack', 'digital']],
  ['banking', ['bank', 'credit', 'loan', 'deposit', 'interest', 'capital', 'reserves', 'margin', 'lending', 'financial', 'liquidity']],
  ['energy', ['solar', 'renewable', 'green', 'power', 'clean', 'oil', 'gas', 'grid', 'energy', 'electricity', 'photovoltaic']],
  ['automotive', ['vehicle', 'car', 'motor', 'ev', 'battery', 'autonomous', 'driving', 'manufacturing', 'fleet', 'chassis', 'assembly']],
  ['healthcare', ['pharma', 'clinical', 'drug', 'medicine', 'trial', 'patient', 'health', 'therapy', 'biotech', 'fda', 'oncology']],
  ['utilities', ['utility', 'power', 'grid', 'transmission', 'distribution', 'tariff', 'water', 'infrastructure', 'substation']],
  ['growth', ['revenue', 'surge', 'expansion', 'growth', 'upside', 'accelerate', 'record', 'scale', 'demand', 'adoption']],
  ['profit', ['earnings', 'profit', 'margin', 'ebitda', 'cashflow', 'dividend', 'return', 'yield', 'eps', 'profitability']],
  ['risk', ['debt', 'liability', 'downgrade', 'lawsuit', 'inflation', 'default', 'loss', 'threat', 'risk', 'headwind']],
  ['bullish', ['outperformer', 'buy', 'overweight', 'optimism', 'rally', 'breakout', 'target', 'beat', 'premium', 'strong']],
  ['bearish', ['sell', 'underperform', 'underweight', 'downgrade', 'drop', 'slump', 'miss', 'correction', 'slowdown', 'weak']],
  ['governance', ['audit', 'board', 'compliance', 'regulation', 'sec', 'sebi', 'fiduciary', 'transparency', 'policy', 'sanction']]
];

const NUM_CONCEPTS = CONCEPTS.length; // 12 anchor dimensions
export const VECTOR_DIMENSION = 64;

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

export function generateEmbedding(text, dim = VECTOR_DIMENSION) {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const vec = new Float64Array(dim);
  if (words.length === 0) return Array.from(vec);

  const wordSet = new Set(words);

  // 1. Domain concept projections (dimensions 0 .. NUM_CONCEPTS - 1)
  for (let c = 0; c < NUM_CONCEPTS; c++) {
    const [, terms] = CONCEPTS[c];
    let score = 0;
    for (const term of terms) {
      if (wordSet.has(term)) {
        score += 2.0;
      } else {
        for (const w of words) {
          if (w.length >= 4 && (w.includes(term) || term.includes(w))) {
            score += 0.6;
          }
        }
      }
    }
    vec[c] = score;
  }

  // 2. Term & bigram feature hashing (dimensions NUM_CONCEPTS .. dim - 1)
  const hashRange = dim - NUM_CONCEPTS;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const h1 = fnv1a(w);
    const bucket1 = NUM_CONCEPTS + (h1 % hashRange);
    const sign1 = (h1 & 1) === 0 ? 1 : -1;
    vec[bucket1] += sign1 * 1.0;

    // Bigram feature capture
    if (i < words.length - 1) {
      const bi = w + '_' + words[i + 1];
      const h2 = fnv1a(bi);
      const bucket2 = NUM_CONCEPTS + (h2 % hashRange);
      const sign2 = (h2 & 1) === 0 ? 1 : -1;
      vec[bucket2] += sign2 * 1.3;
    }
  }

  // 3. Euclidean L2-normalization for cosine distance compatibility
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

// Formats vector array as PostgreSQL pgvector string literal: '[0.123456,0.654321,...]'
export function toVectorLiteral(vec) {
  return '[' + vec.map(v => Number(v.toFixed(6))).join(',') + ']';
}

export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

/** A vector and what the person decided about it. */
export interface LabelledVector {
  vector: Float64Array;
  relevant: boolean;
}

/** A decided article in the order it entered the project, as a simulation walks it. */
export interface SimulatedArticle extends LabelledVector {
  id: number;
}

/** Until there are this many of each, the classifier has too little to go on and the original order stands. */
export const MIN_RELEVANT = 3;
export const MIN_EXCLUDED = 3;

const LEARNING_RATE = 1;
const L2_PENALTY = 0.001;
const TRAINING_STEPS = 100;
// A simulation trains again and again from where it stopped, so each round needs few steps.
const STEPS_PER_RETRAIN = 30;
const RETRAINS_IN_A_SIMULATION = 50;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Scales a vector to length 1, so no provider's scale weighs more than another's.
 *
 * @example normalized(new Float32Array([3, 4])) // [0.6, 0.8]
 */
export function normalized(vector: ArrayLike<number>): Float64Array {
  const out = Float64Array.from(vector as ArrayLike<number>);
  const length = Math.sqrt(out.reduce((sum, value) => sum + value * value, 0));
  if (length > 0) out.forEach((value, i) => (out[i] = value / length));
  return out;
}

function logit(weights: Float64Array, vector: Float64Array): number {
  let sum = weights[vector.length];
  for (let i = 0; i < vector.length; i++) sum += weights[i] * vector[i];
  return sum;
}

/**
 * How likely the article is relevant, from 0 to 1.
 *
 * @example relevanceOf(train(examples), vector) // 0.93
 */
export const relevanceOf = (weights: Float64Array, vector: Float64Array): number => sigmoid(logit(weights, vector));

/**
 * Logistic regression by gradient descent, with no randomness, so the same decisions give the same order. Relevant
 * articles are the minority of a screening, so each class weighs the same: otherwise "exclude everything" would win.
 *
 * @example const weights = train([{ vector, relevant: true }, { vector: other, relevant: false }]);
 */
export function train(examples: LabelledVector[], start?: Float64Array, steps = TRAINING_STEPS): Float64Array {
  const size = examples[0].vector.length;
  const weights = start ? Float64Array.from(start) : new Float64Array(size + 1);
  const relevant = examples.filter((example) => example.relevant).length;
  const weightOf = (isRelevant: boolean) =>
    examples.length / (2 * Math.max(1, isRelevant ? relevant : examples.length - relevant));
  const gradient = new Float64Array(size + 1);
  for (let step = 0; step < steps; step++) {
    gradient.fill(0);
    for (const { vector, relevant: isRelevant } of examples) {
      const error = (relevanceOf(weights, vector) - (isRelevant ? 1 : 0)) * weightOf(isRelevant);
      for (let i = 0; i < size; i++) gradient[i] += error * vector[i];
      gradient[size] += error;
    }
    for (let i = 0; i <= size; i++) {
      const penalty = i < size ? L2_PENALTY * weights[i] : 0;
      weights[i] -= LEARNING_RATE * (gradient[i] / examples.length + penalty);
    }
  }
  return weights;
}

/**
 * Whether there are enough examples to begin, and how many are missing of each.
 *
 * @example examplesNeeded(2, 3) // { needRelevant: 1, needExcluded: 0 }
 */
export function examplesNeeded(relevant: number, excluded: number) {
  return { needRelevant: Math.max(0, MIN_RELEVANT - relevant), needExcluded: Math.max(0, MIN_EXCLUDED - excluded) };
}

/**
 * The ids likeliest first; a tie keeps the order given, so it is the same every time.
 *
 * @example rankByRelevance(examples, pending) // [7, 3, 9]
 */
export function rankByRelevance(examples: LabelledVector[], pending: { id: number; vector: Float64Array }[]): number[] {
  const weights = train(examples);
  return pending
    .map(({ id, vector }, position) => ({ id, position, score: relevanceOf(weights, vector) }))
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map(({ id }) => id);
}

const cumulative = (flags: boolean[]): number[] => {
  let found = 0;
  return flags.map((flag) => (found += flag ? 1 : 0));
};

/** Whether the screened so far let the classifier begin. */
function canLearn(seen: LabelledVector[]): boolean {
  const relevant = seen.filter((article) => article.relevant).length;
  const { needRelevant, needExcluded } = examplesNeeded(relevant, seen.length - relevant);
  return needRelevant === 0 && needExcluded === 0;
}

// The event loop of the main process must keep breathing during a long simulation.
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * Screens the decided articles again with the person's decisions as the answers: in the original order until it can
 * learn, then always the likeliest next, retraining every so often. Has no randomness: it starts from the same order
 * and so repeats its result, which replaces the fixed seed the issue asks for.
 *
 * @example const predicted = await simulateFound(articles); // [1, 1, 2, 3, ...]
 */
export async function simulateFound(articles: SimulatedArticle[]): Promise<number[]> {
  const batch = Math.max(1, Math.ceil(articles.length / RETRAINS_IN_A_SIMULATION));
  let remaining = [...articles];
  const seen: SimulatedArticle[] = [];
  let weights: Float64Array | undefined;
  while (remaining.length > 0) {
    if (canLearn(seen)) {
      weights = train(seen, weights, weights ? STEPS_PER_RETRAIN : TRAINING_STEPS);
      const current = weights;
      remaining = remaining
        .map((article, position) => ({ article, position, score: relevanceOf(current, article.vector) }))
        .sort((a, b) => b.score - a.score || a.position - b.position)
        .map(({ article }) => article);
      seen.push(...remaining.splice(0, batch));
      await breathe();
    } else {
      seen.push(...remaining.splice(0, 1));
    }
  }
  return cumulative(seen.map((article) => article.relevant));
}

/**
 * How many relevant the original order would have found after each article.
 *
 * @example originalFound(articles) // [0, 1, 1, 2, ...]
 */
export const originalFound = (articles: SimulatedArticle[]): number[] =>
  cumulative(articles.map((article) => article.relevant));

// Canonical Bubo 4 brand assets.
// Derived from the official transparent PNGs supplied by the project owner.
// Never replace these with generated owls or placeholders.

export const buboBrand = {
  mark: require('../../assets/bubo/brand-mark.webp'),
  wordmark: require('../../assets/bubo/brand-wordmark.webp'),
} as const;

export const buboMascots = {
  neutral: require('../../assets/bubo/mascots/mascot-neutral.webp'),
  reading: require('../../assets/bubo/mascots/mascot-reading.webp'),
  readingAlt: require('../../assets/bubo/mascots/mascot-reading-alt.webp'),
  book: require('../../assets/bubo/mascots/mascot-book.webp'),
  readingStack: require('../../assets/bubo/mascots/mascot-reading-stack.webp'),
  happyWave: require('../../assets/bubo/mascots/mascot-happy-wave.webp'),
  happyWink: require('../../assets/bubo/mascots/mascot-happy-wink.webp'),
  happySparkles: require('../../assets/bubo/mascots/mascot-happy-sparkles.webp'),
  celebrateConfetti: require('../../assets/bubo/mascots/mascot-celebrate-confetti.webp'),
  celebrateBox: require('../../assets/bubo/mascots/mascot-celebrate-box.webp'),
  achievementMedal: require('../../assets/bubo/mascots/mascot-achievement-medal.webp'),
  curious: require('../../assets/bubo/mascots/mascot-curious.webp'),
  curiousQuestion: require('../../assets/bubo/mascots/mascot-curious-question.webp'),
  concerned: require('../../assets/bubo/mascots/mascot-concerned.webp'),
  sad: require('../../assets/bubo/mascots/mascot-sad.webp'),
  surprised: require('../../assets/bubo/mascots/mascot-surprised.webp'),
  idea: require('../../assets/bubo/mascots/mascot-idea.webp'),
  writing: require('../../assets/bubo/mascots/mascot-writing.webp'),
  laptop: require('../../assets/bubo/mascots/mascot-laptop.webp'),
  quizCards: require('../../assets/bubo/mascots/mascot-quiz-cards.webp'),
  loadingStudy: require('../../assets/bubo/mascots/mascot-loading-study.webp'),
  sleeping: require('../../assets/bubo/mascots/mascot-sleeping.webp'),
  sleepyCoffee: require('../../assets/bubo/mascots/mascot-sleepy-coffee.webp'),
  error: require('../../assets/bubo/mascots/mascot-error.webp'),
} as const;

export type BuboMascotState = keyof typeof buboMascots;

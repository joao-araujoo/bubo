const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');

const baseUser = {
  username: 'leitor_teste',
  email: 'leitor@example.com',
  password: 'senha-segura'
};

test('new users start with onboarding pending and safe defaults', () => {
  const user = new User(baseUser);

  assert.equal(user.onboardingCompleted, false);
  assert.equal(user.readingPreferences.primaryGoal, 'retain');
  assert.equal(user.readingPreferences.pace, 'steady');
  assert.equal(user.readingPreferences.weeklyReviewTarget, 2);
  assert.deepEqual(user.readingPreferences.favoriteGenres, []);
  assert.equal(user.validateSync(), undefined);
});

test('reader preferences accept a complete onboarding profile', () => {
  const user = new User({
    ...baseUser,
    readingGoal: 24,
    onboardingCompleted: true,
    readingPreferences: {
      primaryGoal: 'reflect',
      pace: 'intensive',
      favoriteGenres: ['Filosofia', 'Ficção literária'],
      weeklyReviewTarget: 4
    }
  });

  assert.equal(user.validateSync(), undefined);
});

test('reader preferences reject invalid pace and excessive genres', () => {
  const user = new User({
    ...baseUser,
    readingPreferences: {
      primaryGoal: 'retain',
      pace: 'impossible',
      favoriteGenres: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      weeklyReviewTarget: 30
    }
  });
  const error = user.validateSync();

  assert.ok(error?.errors['readingPreferences.pace']);
  assert.ok(error?.errors['readingPreferences.favoriteGenres']);
  assert.ok(error?.errors['readingPreferences.weeklyReviewTarget']);
});

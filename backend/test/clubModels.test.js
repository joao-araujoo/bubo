const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ReadingClub = require('../src/models/ReadingClub');
const ClubMembership = require('../src/models/ClubMembership');
const ClubDiscussion = require('../src/models/ClubDiscussion');

const objectId = () => new mongoose.Types.ObjectId();

test('ReadingClub accepts a valid public club', () => {
  const club = new ReadingClub({
    name: 'Expedição por Arrakis',
    description: 'Leitura coletiva de Duna.',
    ownerId: objectId(),
    bookId: objectId(),
    visibility: 'public',
    memberLimit: 30,
  });

  assert.equal(club.validateSync(), undefined);
});

test('ReadingClub rejects invalid visibility and member limits', () => {
  const club = new ReadingClub({
    name: 'Clube inválido',
    ownerId: objectId(),
    bookId: objectId(),
    visibility: 'secret',
    memberLimit: 1,
  });

  const error = club.validateSync();
  assert.ok(error);
  assert.ok(error.errors.visibility);
  assert.ok(error.errors.memberLimit);
});

test('ClubMembership rejects negative progress', () => {
  const membership = new ClubMembership({
    clubId: objectId(),
    userId: objectId(),
    currentPage: -1,
  });

  const error = membership.validateSync();
  assert.ok(error?.errors.currentPage);
});

test('ClubDiscussion validates content and contextual page bounds', () => {
  const validDiscussion = new ClubDiscussion({
    clubId: objectId(),
    userId: objectId(),
    body: 'O ambiente condiciona todas as escolhas políticas do romance.',
    insight: 'Arrakis funciona como personagem.',
    pageFrom: 120,
    pageTo: 140,
  });

  assert.equal(validDiscussion.validateSync(), undefined);

  const invalidDiscussion = new ClubDiscussion({
    clubId: objectId(),
    userId: objectId(),
    body: '',
    pageFrom: -2,
  });

  const error = invalidDiscussion.validateSync();
  assert.ok(error?.errors.body);
  assert.ok(error?.errors.pageFrom);
});

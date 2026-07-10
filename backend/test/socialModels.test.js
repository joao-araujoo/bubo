const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const SocialComment = require('../src/models/SocialComment');
const SocialInteraction = require('../src/models/SocialInteraction');
const UserFollow = require('../src/models/UserFollow');

const objectId = () => new mongoose.Types.ObjectId();

const hasUniqueIndex = (model, fields) => model.schema.indexes().some(([definition, options]) => (
  options.unique === true
  && Object.keys(fields).every((key) => definition[key] === fields[key])
));

test('SocialInteraction validates supported kinds and prevents duplicate logical interactions', () => {
  const valid = new SocialInteraction({
    activityId: objectId(),
    userId: objectId(),
    kind: 'like'
  });
  const invalid = new SocialInteraction({
    activityId: objectId(),
    userId: objectId(),
    kind: 'applause'
  });

  assert.equal(valid.validateSync(), undefined);
  assert.ok(invalid.validateSync()?.errors.kind);
  assert.equal(hasUniqueIndex(SocialInteraction, { activityId: 1, userId: 1, kind: 1 }), true);
});

test('SocialComment requires content and enforces its maximum length', () => {
  const empty = new SocialComment({
    activityId: objectId(),
    userId: objectId(),
    body: ''
  });
  const tooLong = new SocialComment({
    activityId: objectId(),
    userId: objectId(),
    body: 'a'.repeat(1201)
  });

  assert.ok(empty.validateSync()?.errors.body);
  assert.ok(tooLong.validateSync()?.errors.body);
});

test('UserFollow has a unique follower relationship index', () => {
  assert.equal(hasUniqueIndex(UserFollow, { followerId: 1, followingId: 1 }), true);
});

test('Notification accepts only product notification types', () => {
  const valid = new Notification({
    recipientId: objectId(),
    actorId: objectId(),
    type: 'comment'
  });
  const invalid = new Notification({
    recipientId: objectId(),
    actorId: objectId(),
    type: 'system'
  });

  assert.equal(valid.validateSync(), undefined);
  assert.ok(invalid.validateSync()?.errors.type);
});

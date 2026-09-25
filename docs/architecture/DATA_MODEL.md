# Bubo 4 — target domain model

This is the planning model, not a promise to create every table in the first migration.

## Identity
- User
- Profile
- UserSettings
- AuthAccount / Session

## Books
- Work
- Edition
- UserBook
- ReadingProgress
- ReadingSession
- Reflection
- BookReview

## Cognitive core
- ReadingUnit
- Concept
- ConceptEvidence
- AssessmentBlueprint
- AssessmentItem
- RecallSession
- RecallResponse
- Evaluation
- MasteryEstimate
- RetentionEstimate
- ReviewSchedule
- ScoreSnapshot
- ScoreEvidence

## Gamification
- XPEvent
- StreakDay
- AchievementDefinition
- UserAchievement
- MissionDefinition
- UserMission

## Social
- Follow
- Post
- Comment
- Reaction
- SavedPost
- Report
- Block

## Clubs
- Club
- ClubMember
- ClubBook
- ClubDiscussion
- ClubComment
- ClubMeeting
- ClubPoll
- ClubPollOption
- ClubPollVote
- SpoilerBoundary

## Notifications
- Notification
- NotificationPreference
- DevicePushToken

## Media
- MediaObject (R2 key, owner, MIME type, size, status)

## Non-negotiable properties
- Score/evaluation rows carry algorithm/model/prompt versions.
- AI output never overwrites the user's original answer.
- Evidence provenance is stored separately from derived scores.
- Destructive social/moderation actions are auditable.

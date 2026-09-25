# Bubo Score — architecture contract

The scoring engine is a server-side, versioned domain component. The mobile app renders score outputs; it does not calculate them.

## Distinct concepts
Never collapse these into one opaque number internally:

- Session Performance
- Book Mastery
- Recall
- Understanding
- Inference
- Application / Transfer
- Retention
- Metacognitive Calibration
- Reader Growth

## Required output metadata
Every published estimate should be able to carry:

- value or band;
- confidence (`insufficient`, `low`, `medium`, `high`);
- evidence count;
- algorithm version;
- computed-at timestamp;
- explanation inputs suitable for user-facing “why did this change?”.

## V1 principle
Start interpretable. Prefer explicit evidence/rubrics plus uncertainty-aware aggregation over a sophisticated model that cannot be validated with the initial dataset.

## Versioning
A future `bubo-score-v2` must not silently rewrite historical v1 scores. Snapshots retain the version that produced them.

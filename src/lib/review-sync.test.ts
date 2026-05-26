import assert from "node:assert/strict";
import test from "node:test";
import { prepareReviewSyncPayload } from "./review-sync";

test("prepareReviewSyncPayload builds review state and event payloads with the same timestamp", () => {
  const reviewedAt = "2026-05-26T08:30:00.000Z";

  const payload = prepareReviewSyncPayload({
    card: {
      vocabulary_item_id: "vocab-1",
      review_state_id: "state-1",
      ease_factor: 2.5,
      interval_days: 3,
      repetitions: 2,
    },
    rating: "easy",
    userId: "user-1",
    reviewedAt,
    reviewEventId: "event-1",
  });

  assert.equal(payload.reviewStateId, "state-1");
  assert.equal(payload.reviewedAt, reviewedAt);
  assert.equal(payload.reviewStateUpdate.last_reviewed_at, reviewedAt);
  assert.equal(payload.reviewEventInsert.reviewed_at, reviewedAt);
  assert.equal(payload.reviewEventInsert.id, "event-1");
  assert.equal(payload.reviewEventInsert.user_id, "user-1");
  assert.equal(payload.reviewEventInsert.vocabulary_item_id, "vocab-1");
  assert.equal(payload.reviewEventInsert.rating, "easy");
  assert.equal(typeof payload.reviewStateUpdate.next_review_at, "string");
});

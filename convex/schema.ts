import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // One row per share code. A code is the whole handle to a settings slot:
  // whoever has it can pull and push, which is the point — you read it off one
  // device and type it into the next.
  syncedSettings: defineTable({
    code: v.string(),
    // Syncable settings as a JSON string. Kept opaque on purpose: the set of
    // clock settings changes often, and the client already merges unknown or
    // missing keys against its defaults, so the backend never needs a redeploy
    // when a setting is added.
    payload: v.string(),
    // Bumped on every successful push; the client sends the revision it last
    // saw so a stale device can't silently overwrite a newer push.
    revision: v.number(),
    updatedAt: v.number(),
  })
    .index('by_code', ['code'])
    .index('by_updatedAt', ['updatedAt']),
});

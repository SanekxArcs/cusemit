import { mutation, query, type MutationCtx } from './_generated/server';
import { v } from 'convex/values';

// Unambiguous alphabet: no O/0, I/1, or U, so a code read off one screen and
// typed into another can't land on the wrong row.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTVWXYZ';
const CODE_LENGTH = 8;

// Settings are small (a few KB of JSON); the cap is only here so a bad client
// can't park a megabyte of data on a guessed code.
const MAX_PAYLOAD_BYTES = 128_000;

/** Uppercases and strips separators so "abcd-efgh" and "ABCDEFGH" are one code. */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function findByCode(ctx: MutationCtx, code: string) {
  return await ctx.db
    .query('syncedSettings')
    .withIndex('by_code', (q) => q.eq('code', code))
    .unique();
}

function validatePayload(payload: string) {
  if (payload.length > MAX_PAYLOAD_BYTES) {
    throw new Error('These settings are too large to sync.');
  }
  try {
    const parsed = JSON.parse(payload);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
  } catch {
    throw new Error('Settings payload must be a JSON object.');
  }
}

/**
 * Claims a fresh code and stores the first payload under it. Retries on the
 * (vanishingly unlikely) collision rather than handing back someone else's slot.
 */
export const create = mutation({
  args: { payload: v.string() },
  returns: v.object({
    code: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    validatePayload(args.payload);
    let code = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      if ((await findByCode(ctx, code)) === null) break;
      code = randomCode();
    }
    const updatedAt = Date.now();
    await ctx.db.insert('syncedSettings', {
      code,
      payload: args.payload,
      revision: 1,
      updatedAt,
    });
    return { code, revision: 1, updatedAt };
  },
});

/** Reads a code's settings. Returns null for an unknown code. */
export const pull = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      payload: v.string(),
      revision: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    if (code.length !== CODE_LENGTH) return null;
    const row = await ctx.db
      .query('syncedSettings')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique();
    if (row === null) return null;
    return {
      payload: row.payload,
      revision: row.revision,
      updatedAt: row.updatedAt,
    };
  },
});

/**
 * Writes settings to an existing code.
 *
 * `baseRevision` is the revision this device last saw. If the stored row has
 * moved past it, the push is refused with `status: 'stale'` and the caller can
 * decide to pull first or push again with `force`.
 */
export const push = mutation({
  args: {
    code: v.string(),
    payload: v.string(),
    baseRevision: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      status: v.literal('ok'),
      revision: v.number(),
      updatedAt: v.number(),
    }),
    v.object({ status: v.literal('missing') }),
    v.object({
      status: v.literal('stale'),
      revision: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    validatePayload(args.payload);
    const code = normalizeCode(args.code);
    const row = await findByCode(ctx, code);
    if (row === null) return { status: 'missing' as const };

    if (
      !args.force &&
      args.baseRevision !== undefined &&
      row.revision > args.baseRevision
    ) {
      return {
        status: 'stale' as const,
        revision: row.revision,
        updatedAt: row.updatedAt,
      };
    }

    const revision = row.revision + 1;
    const updatedAt = Date.now();
    await ctx.db.patch(row._id, { payload: args.payload, revision, updatedAt });
    return { status: 'ok' as const, revision, updatedAt };
  },
});

/** Permanently deletes a code and the settings stored under it. */
export const destroy = mutation({
  args: { code: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await findByCode(ctx, normalizeCode(args.code));
    if (row === null) return false;
    await ctx.db.delete(row._id);
    return true;
  },
});

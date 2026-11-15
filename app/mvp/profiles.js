'use strict';

/**
 * ACE — Profiles & platforms.
 *
 * A profile is one publishing channel (Shopee Affiliate today, Lazada / TikTok /
 * YouTube next) with its own handle, posting window and language. Everything the
 * content pipeline produces hangs off a profile id, so the same core workflow is
 * reused per channel instead of forking it per platform.
 *
 * This module only describes profiles and validates them; the server owns
 * persistence and the routes.
 *
 * Reconstructed 2026-11-15: the working-tree copy of this file had lost every
 * export (only the PLATFORMS table survived), which made readState()/baseState()
 * throw `profilesModule.baseProfiles is not a function` for every state-backed
 * endpoint. The API below is rebuilt to match exactly what app/mvp/service.js
 * calls (baseProfiles, ensureProfiles, listProfiles, activeProfile, resolveProfile,
 * profileView, platformCatalog, createProfile, updateProfile, activateProfile).
 */

const crypto = require('node:crypto');

const PLATFORMS = {
  SHOPEE: {
    key: 'SHOPEE',
    label: 'Shopee Affiliate',
    channel: 'SHOPEE',
    status: 'LIVE',
    link_kind: 'AFFILIATE_LINK',
    aspect_ratio: '9:16',
    max_duration_s: 60,
    capabilities: {
      affiliate_link: true,
      product_feed: true,
      scheduled_publish: true,
      revenue_import: false,
    },
  },
  LAZADA: {
    key: 'LAZADA',
    label: 'Lazada Affiliate',
    channel: 'LAZADA',
    status: 'PLANNED',
    link_kind: 'AFFILIATE_LINK',
    aspect_ratio: '9:16',
    max_duration_s: 60,
    capabilities: {
      affiliate_link: true,
      product_feed: false,
      scheduled_publish: true,
      revenue_import: false,
    },
  },
  TIKTOK: {
    key: 'TIKTOK',
    label: 'TikTok Affiliate',
    channel: 'TIKTOK',
    status: 'PLANNED',
    link_kind: 'PRODUCT_LINK',
    aspect_ratio: '9:16',
    max_duration_s: 180,
    capabilities: {
      affiliate_link: true,
      product_feed: false,
      scheduled_publish: true,
      revenue_import: false,
    },
  },
  YOUTUBE: {
    key: 'YOUTUBE',
    label: 'YouTube Channel',
    channel: 'YOUTUBE',
    status: 'PLANNED',
    link_kind: 'DESCRIPTION_LINK',
    aspect_ratio: '9:16',
    max_duration_s: 180,
    capabilities: {
      affiliate_link: true,
      product_feed: false,
      scheduled_publish: true,
      revenue_import: false,
    },
  }
};

const PLATFORM_KEYS = Object.keys(PLATFORMS);
const PROFILE_STATUSES = ['ACTIVE', 'PAUSED'];

function nowIso() {
  return new Date().toISOString();
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function newProfileId() {
  return 'PF-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/** Base (empty) profile collections spread into a fresh state object. */
function baseProfiles() {
  return { profiles: {}, profileOrder: [], active_profile_id: null };
}

/** Platform catalog for the settings UI — copies only, never the live table. */
function platformCatalog() {
  return PLATFORM_KEYS.map((key) => ({ ...PLATFORMS[key] }));
}

function validatePlatform(value) {
  const key = cleanText(value, 20).toUpperCase();
  if (!PLATFORMS[key]) {
    throw httpError(400, `platform must be one of ${PLATFORM_KEYS.join(', ')}`);
  }
  return key;
}

function validateStatus(value) {
  const status = cleanText(value, 12).toUpperCase() || 'ACTIVE';
  if (PROFILE_STATUSES.indexOf(status) === -1) {
    throw httpError(400, `profile status must be one of ${PROFILE_STATUSES.join(', ')}`);
  }
  return status;
}

/**
 * Seeds the default Shopee profile once, in memory; it is persisted on the
 * next write (see readState's contract in service.js). Idempotent: a state
 * that already carries profiles is left untouched.
 */
function ensureProfiles(state) {
  if (!state.profiles || typeof state.profiles !== 'object' || Array.isArray(state.profiles)) {
    state.profiles = {};
  }
  if (!Array.isArray(state.profileOrder)) {
    state.profileOrder = [];
  }
  if (state.active_profile_id === undefined) {
    state.active_profile_id = null;
  }
  if (state.profileOrder.length === 0) {
    const profile = {
      id: newProfileId(),
      name: 'Shopee Affiliate (เริ่มต้น)',
      platform: 'SHOPEE',
      handle: '',
      status: 'ACTIVE',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.profiles[profile.id] = profile;
    state.profileOrder.push(profile.id);
    state.active_profile_id = profile.id;
  }
}

function rawProfiles(state) {
  const order = Array.isArray(state.profileOrder) ? state.profileOrder : [];
  const map = state.profiles && typeof state.profiles === 'object' ? state.profiles : {};
  return order.map((id) => map[id]).filter(Boolean);
}

function profileView(state, profile) {
  const platform = PLATFORMS[profile.platform] || null;
  return {
    id: profile.id,
    name: profile.name,
    platform: profile.platform,
    platform_label: platform ? platform.label : profile.platform,
    platform_status: platform ? platform.status : 'UNKNOWN',
    channel: platform ? platform.channel : profile.platform,
    handle: profile.handle || '',
    status: profile.status || 'ACTIVE',
    created_at: profile.created_at || null,
    updated_at: profile.updated_at || null,
    active: state.active_profile_id === profile.id,
  };
}

function listProfiles(state) {
  return rawProfiles(state).map((profile) => profileView(state, profile));
}

/** The profile new content projects attach to, or null when none exists. */
function activeProfile(state) {
  if (state.active_profile_id && state.profiles && state.profiles[state.active_profile_id]) {
    return state.profiles[state.active_profile_id];
  }
  return rawProfiles(state)[0] || null;
}

function resolveProfile(state, profileId) {
  if (!profileId || !state.profiles || typeof state.profiles !== 'object') return null;
  return state.profiles[profileId] || null;
}

function createProfile(state, body) {
  const input = body && typeof body === 'object' ? body : {};
  const name = cleanText(input.name, 80);
  if (!name) throw httpError(400, 'profile name is required');
  const profile = {
    id: newProfileId(),
    name,
    platform: validatePlatform(input.platform || 'SHOPEE'),
    handle: cleanText(input.handle, 120),
    status: validateStatus(input.status),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.profiles[profile.id] = profile;
  state.profileOrder.push(profile.id);
  if (!state.active_profile_id) state.active_profile_id = profile.id;
  return profile;
}

function updateProfile(state, profileId, body) {
  const profile = resolveProfile(state, profileId);
  if (!profile) throw httpError(404, 'profile not found');
  const input = body && typeof body === 'object' ? body : {};
  if (input.name !== undefined) {
    const name = cleanText(input.name, 80);
    if (!name) throw httpError(400, 'profile name must not be empty');
    profile.name = name;
  }
  if (input.platform !== undefined) profile.platform = validatePlatform(input.platform);
  if (input.handle !== undefined) profile.handle = cleanText(input.handle, 120);
  if (input.status !== undefined) profile.status = validateStatus(input.status);
  profile.updated_at = nowIso();
  return profile;
}

function activateProfile(state, profileId) {
  const profile = resolveProfile(state, profileId);
  if (!profile) throw httpError(404, 'profile not found');
  state.active_profile_id = profile.id;
  return profile;
}

module.exports = {
  PLATFORMS,
  PLATFORM_KEYS,
  PROFILE_STATUSES,
  platformCatalog,
  baseProfiles,
  ensureProfiles,
  listProfiles,
  activeProfile,
  resolveProfile,
  profileView,
  createProfile,
  updateProfile,
  activateProfile,
};

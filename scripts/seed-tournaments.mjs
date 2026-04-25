import { createClient } from '@supabase/supabase-js';

function fail(message) {
  console.error(`\n[seed:tournaments] ${message}`);
  process.exit(1);
}

function normalizeTournamentName(input) {
  return (input ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseAdminIds(raw) {
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseTournamentConfig(rawJson, startsAt, locksAt) {
  if (!rawJson) {
    return [
      {
        name: 'Michigan Group',
        slug: 'michigan-group-2026',
        visibility: 'public',
        status: 'open',
        starts_at: startsAt,
        locks_at: locksAt,
      },
      {
        name: 'Close Friends',
        slug: 'close-friends-2026',
        visibility: 'private',
        status: 'open',
        starts_at: startsAt,
        locks_at: locksAt,
      },
      {
        name: 'Family',
        slug: 'family-2026',
        visibility: 'private',
        status: 'open',
        starts_at: startsAt,
        locks_at: locksAt,
      },
    ];
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    fail('SEED_TOURNAMENTS_JSON is not valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail('SEED_TOURNAMENTS_JSON must be a non-empty JSON array.');
  }

  return parsed.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      fail(`Tournament entry at index ${idx} must be an object.`);
    }

    const name = String(item.name ?? '').trim();
    if (!name) {
      fail(`Tournament entry at index ${idx} is missing a valid 'name'.`);
    }

    const visibility = item.visibility === 'private' ? 'private' : 'public';
    const status = item.status ?? 'open';

    return {
      name,
      slug: String(item.slug ?? slugify(name)),
      visibility,
      status,
      starts_at: item.starts_at ?? startsAt,
      locks_at: item.locks_at ?? locksAt,
    };
  });
}

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminIdsRaw = process.env.SEED_ADMIN_USER_IDS ?? '';
  const startsAt = process.env.SEED_STARTS_AT ?? '2026-06-01T00:00:00Z';
  const locksAt = process.env.SEED_LOCKS_AT ?? '2026-06-10T23:59:59Z';

  if (!supabaseUrl) {
    fail('Missing SUPABASE_URL (or VITE_SUPABASE_URL) in environment.');
  }

  if (!serviceRoleKey) {
    fail('Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
  }

  const adminIds = parseAdminIds(adminIdsRaw);
  if (adminIds.length === 0) {
    fail('Missing SEED_ADMIN_USER_IDS. Provide one or more UUIDs, comma-separated.');
  }

  const tournaments = parseTournamentConfig(
    process.env.SEED_TOURNAMENTS_JSON,
    startsAt,
    locksAt,
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('[seed:tournaments] Upserting global admins...');
  const { error: adminsError } = await supabase
    .from('tournament_admins')
    .upsert(adminIds.map(user_id => ({ user_id })), { onConflict: 'user_id' });

  if (adminsError) {
    fail(`Failed to upsert tournament_admins: ${adminsError.message}`);
  }

  const creatorId = adminIds[0];
  const tournamentPayload = tournaments.map(t => ({
    ...t,
    normalized_name: normalizeTournamentName(t.name),
    created_by: creatorId,
  }));

  console.log(`[seed:tournaments] Upserting ${tournamentPayload.length} tournaments...`);
  const { data: tournamentRows, error: tournamentsError } = await supabase
    .from('tournaments')
    .upsert(tournamentPayload, { onConflict: 'normalized_name' })
    .select('id, name');

  if (tournamentsError) {
    fail(`Failed to upsert tournaments: ${tournamentsError.message}`);
  }

  const rows = tournamentRows ?? [];
  if (rows.length === 0) {
    fail('No tournament rows returned from upsert.');
  }

  const membershipPayload = [];
  for (const tournament of rows) {
    for (const adminId of adminIds) {
      membershipPayload.push({
        tournament_id: tournament.id,
        user_id: adminId,
        role: 'admin',
      });
    }
  }

  console.log('[seed:tournaments] Upserting admin memberships...');
  const { error: membershipsError } = await supabase
    .from('tournament_memberships')
    .upsert(membershipPayload, { onConflict: 'tournament_id,user_id' });

  if (membershipsError) {
    fail(`Failed to upsert tournament_memberships: ${membershipsError.message}`);
  }

  console.log('\n[seed:tournaments] Done.');
  console.log(`[seed:tournaments] Admin count: ${adminIds.length}`);
  console.log(`[seed:tournaments] Tournament count: ${rows.length}`);
  for (const row of rows) {
    console.log(`- ${row.name} (${row.id})`);
  }
}

void run();

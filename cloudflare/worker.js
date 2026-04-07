const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
      ...CORS
    }
  });
}

function err(message, status = 400, origin = '') {
  return json({ error: message }, status, origin);
}

function corsHeaders(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      hash: 'SHA-256',
      iterations: 10000
    },
    key,
    256
  );

  const hashHex = [...new Uint8Array(bits)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;

  const [saltHex, hashHex] = stored.split(':');
  const parts = saltHex.match(/.{2}/g);
  if (!parts) return false;

  const salt = new Uint8Array(parts.map(h => parseInt(h, 16)));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      hash: 'SHA-256',
      iterations: 10000
    },
    key,
    256
  );

  const check = [...new Uint8Array(bits)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return check === hashHex;
}

function parseAuth(request) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return null;

  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(':');
    if (colon < 0) return null;

    return {
      username: decoded.slice(0, colon),
      password: decoded.slice(colon + 1)
    };
  } catch {
    return null;
  }
}

async function getAccount(env, username) {
  if (!username) return null;
  const value = await env.ARCHERY_KV.get(`account:${username.toLowerCase()}`);
  return value ? JSON.parse(value) : null;
}

function normalizePreferencesPayload(body = {}) {
  const rawPreferences = body?.preferences && typeof body.preferences === 'object' ? body.preferences : {};
  const rawGoals = Array.isArray(body?.goals) ? body.goals : [];
  const goals = rawGoals
    .filter(goal => goal && typeof goal === 'object')
    .map(goal => ({
      id: typeof goal.id === 'string' ? goal.id.slice(0, 80) : '',
      metric: ['sessions', 'arrows', 'avg_score', 'best_round'].includes(goal.metric) ? goal.metric : '',
      target: Number.isFinite(Number(goal.target)) ? Math.max(0, Number(goal.target)) : 0,
      createdAt: typeof goal.createdAt === 'string' ? goal.createdAt : new Date().toISOString(),
      archived: !!goal.archived
    }))
    .filter(goal => goal.id && goal.metric && goal.target > 0)
    .slice(0, 12);

  return {
    preferences: {
      pbCelebrationsEnabled: rawPreferences.pbCelebrationsEnabled !== false,
      betaFeaturesEnabled: rawPreferences.betaFeaturesEnabled === true
    },
    goals
  };
}

function normalizeSavedLocationsPayload(rawLocations = []) {
  return (Array.isArray(rawLocations) ? rawLocations : [])
    .filter(location => location && typeof location === 'object')
    .map(location => ({
      label: typeof location.label === 'string' ? location.label.trim().slice(0, 80) : '',
      lat: Number.isFinite(Number(location.lat)) ? Number(location.lat) : null,
      lng: Number.isFinite(Number(location.lng)) ? Number(location.lng) : null,
      updatedAt: typeof location.updatedAt === 'string' ? location.updatedAt : new Date().toISOString()
    }))
    .filter(location => location.label)
    .slice(0, 200);
}

function normalizeBowDataPayload(body = {}) {
  const rawBowProfiles = body?.bowProfiles && typeof body.bowProfiles === 'object' ? body.bowProfiles : {};
  const rawActiveBowId = body?.activeBowId && typeof body.activeBowId === 'object' ? body.activeBowId : {};
  const rawLegacyBows = body?.bows && typeof body.bows === 'object' ? body.bows : {};

  const bowProfiles = Object.fromEntries(
    Object.entries(rawBowProfiles).map(([archerName, bows]) => [
      archerName,
      (Array.isArray(bows) ? bows : [])
        .filter(bow => bow && typeof bow === 'object')
        .map(bow => ({
          id: typeof bow.id === 'string' ? bow.id.slice(0, 80) : `bow-${Date.now()}`,
          name: typeof bow.name === 'string' ? bow.name.trim().slice(0, 80) : '',
          type: typeof bow.type === 'string' ? bow.type.trim().slice(0, 40) : '',
          drawWeight: typeof bow.drawWeight === 'string' ? bow.drawWeight.trim().slice(0, 40) : '',
          notes: typeof bow.notes === 'string' ? bow.notes.trim().slice(0, 2000) : '',
          aimingPoints: bow.aimingPoints && typeof bow.aimingPoints === 'object' ? bow.aimingPoints : {}
        }))
        .slice(0, 20)
    ])
  );

  return {
    bowProfiles,
    activeBowId: Object.fromEntries(Object.entries(rawActiveBowId).map(([archerName, bowId]) => [archerName, typeof bowId === 'string' ? bowId.slice(0, 80) : ''])),
    bows: rawLegacyBows
  };
}

async function verifyAuth(request, env) {
  const creds = parseAuth(request);
  if (!creds) return null;

  const account = await getAccount(env, creds.username);
  if (!account) return null;

  const ok = await verifyPassword(creds.password, account.passwordHash);
  return ok ? account : null;
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

async function parseBase64ImageFromRequest(request, origin) {
  const body = await request.json().catch(() => null);
  const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
  const match = imageDataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) {
    throw new Error('Expected imageDataUrl to be a base64 data URL.');
  }
  return match[1];
}

async function callRoboflowModel({ project, version, confidence, overlap, apiKey, base64Body }) {
  const roboflowUrl = new URL(`https://serverless.roboflow.com/${encodeURIComponent(project)}/${encodeURIComponent(version)}`);
  roboflowUrl.searchParams.set('api_key', apiKey);
  roboflowUrl.searchParams.set('confidence', String(confidence));
  roboflowUrl.searchParams.set('overlap', String(overlap));
  roboflowUrl.searchParams.set('image_type', 'base64');

  const roboflowResponse = await fetch(roboflowUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: base64Body
  });

  const responseText = await roboflowResponse.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = null;
  }

  if (!roboflowResponse.ok || !payload) {
    throw new Error(`Roboflow did not return valid JSON: ${responseText.slice(0, 500)}`);
  }

  return payload;
}

async function handlePhotoScoreHealth(env, origin) {
  return json(
    {
      ok: true,
      roboflowConfigured: !!env.ROBOFLOW_API_KEY,
      project: env.ROBOFLOW_PROJECT || 'scorecard-detector',
      version: env.ROBOFLOW_MODEL_VERSION || '3',
      markProject: env.ROBOFLOW_MARK_PROJECT || 'score-mark-reader',
      markVersion: env.ROBOFLOW_MARK_MODEL_VERSION || '2'
    },
    200,
    origin
  );
}

async function handlePhotoScoreDetect(request, env, origin) {
  if (!env.ROBOFLOW_API_KEY) return err('ROBOFLOW_API_KEY secret is missing in Cloudflare.', 500, origin);

  const base64Body = await parseBase64ImageFromRequest(request, origin);
  const payload = await callRoboflowModel({
    project: env.ROBOFLOW_PROJECT || 'scorecard-detector',
    version: env.ROBOFLOW_MODEL_VERSION || '3',
    confidence: env.ROBOFLOW_CONFIDENCE || '0.4',
    overlap: env.ROBOFLOW_OVERLAP || '0.3',
    apiKey: env.ROBOFLOW_API_KEY,
    base64Body
  });

  const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
  const prediction =
    predictions
      .filter(item => item && typeof item === 'object')
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null;

  return json(
    {
      ok: true,
      image: payload.image || null,
      prediction,
      predictionsCount: predictions.length
    },
    200,
    origin
  );
}

async function handlePhotoScoreRead(request, env, origin) {
  if (!env.ROBOFLOW_API_KEY) return err('ROBOFLOW_API_KEY secret is missing in Cloudflare.', 500, origin);

  const base64Body = await parseBase64ImageFromRequest(request, origin);
  const payload = await callRoboflowModel({
    project: env.ROBOFLOW_MARK_PROJECT || 'score-mark-reader',
    version: env.ROBOFLOW_MARK_MODEL_VERSION || '2',
    confidence: env.ROBOFLOW_MARK_CONFIDENCE || '0.25',
    overlap: env.ROBOFLOW_MARK_OVERLAP || '0.3',
    apiKey: env.ROBOFLOW_API_KEY,
    base64Body
  });

  return json(
    {
      ok: true,
      image: payload.image || null,
      predictions: Array.isArray(payload.predictions) ? payload.predictions : []
    },
    200,
    origin
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...corsHeaders(origin), ...CORS } });
      }

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      // --- Public & Health Routes ---
      if (path === '/ping' && request.method === 'GET') {
        return json({ ok: true }, 200, origin);
      }

      if (path === '/photo-score/health' && request.method === 'GET') {
        return handlePhotoScoreHealth(env, origin);
      }

      if (path === '/photo-score/detect' && request.method === 'POST') {
        return handlePhotoScoreDetect(request, env, origin);
      }

      if (path === '/photo-score/read' && request.method === 'POST') {
        return handlePhotoScoreRead(request, env, origin);
      }

      if (!env.ARCHERY_KV) {
        return err('KV binding ARCHERY_KV is missing', 500, origin);
      }

      // --- Account Management ---
      if (path === '/account/check' && request.method === 'GET') {
        const username = url.searchParams.get('username')?.trim().toLowerCase();
        if (!username) return err('username required', 400, origin);

        const existing = await env.ARCHERY_KV.get(`account:${username}`);
        return json({ taken: existing !== null }, 200, origin);
      }

      if (path === '/account/register' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.username || !body?.password) {
          return err('username and password required', 400, origin);
        }

        const username = body.username.trim();
        const key = `account:${username.toLowerCase()}`;
        const existing = await env.ARCHERY_KV.get(key);
        if (existing) return json({ taken: true }, 409, origin);

        const passwordHash = await hashPassword(body.password);

        await env.ARCHERY_KV.put(
          key,
          JSON.stringify({
            username,
            passwordHash,
            createdAt: new Date().toISOString()
          })
        );

        return json({ ok: true, username }, 200, origin);
      }

      if (path === '/account/login' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.username || !body?.password) {
          return err('username and password required', 400, origin);
        }

        const account = await getAccount(env, body.username);
        if (!account) return err('Invalid credentials', 401, origin);

        const ok = await verifyPassword(body.password, account.passwordHash);
        if (!ok) return err('Invalid credentials', 401, origin);

        return json({ ok: true, username: account.username }, 200, origin);
      }

      if (path === '/account/update-username' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.oldUsername || !body?.password || !body?.newUsername) {
          return err('oldUsername, password, and newUsername required', 400, origin);
        }

        const oldUsername = body.oldUsername.trim();
        const newUsername = body.newUsername.trim();

        const account = await getAccount(env, oldUsername);
        if (!account) return err('Account not found', 401, origin);

        const ok = await verifyPassword(body.password, account.passwordHash);
        if (!ok) return err('Invalid password', 401, origin);

        const newKey = `account:${newUsername.toLowerCase()}`;
        const conflict = await env.ARCHERY_KV.get(newKey);
        if (conflict) return json({ taken: true }, 409, origin);

        await env.ARCHERY_KV.put(
          newKey,
          JSON.stringify({
            ...account,
            username: newUsername
          })
        );

        await env.ARCHERY_KV.delete(`account:${oldUsername.toLowerCase()}`);

        // Update all related sessions
        let cursor;
        do {
          const list = await env.ARCHERY_KV.list({ prefix: 'session:', cursor });
          cursor = list.list_complete ? undefined : list.cursor;

          await Promise.all(
            list.keys.map(async ({ name }) => {
              const value = await env.ARCHERY_KV.get(name);
              if (!value) return;

              const session = JSON.parse(value);
              if ((session.archerName || '').toLowerCase() === oldUsername.toLowerCase()) {
                session.archerName = newUsername;
                await env.ARCHERY_KV.put(name, JSON.stringify(session));
              }
            })
          );
        } while (cursor);

        return json({ ok: true, username: newUsername }, 200, origin);
      }

      if (path === '/account/update-password' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body?.username || !body?.oldPassword || !body?.newPassword) {
          return err('username, oldPassword, and newPassword required', 400, origin);
        }

        const username = body.username.trim();
        const account = await getAccount(env, username);
        if (!account) return err('Account not found', 401, origin);

        const ok = await verifyPassword(body.oldPassword, account.passwordHash);
        if (!ok) return err('Invalid password', 401, origin);

        const newHash = await hashPassword(body.newPassword);

        await env.ARCHERY_KV.put(
          `account:${username.toLowerCase()}`,
          JSON.stringify({
            ...account,
            passwordHash: newHash
          })
        );

        return json({ ok: true }, 200, origin);
      }

      if (path === '/account/preferences' && request.method === 'GET') {
        const account = await verifyAuth(request, env);
        if (!account) return err('Unauthorised', 401, origin);

        const normalized = normalizePreferencesPayload(account);
        const savedLocations = normalizeSavedLocationsPayload(account.savedLocations);
        const bowData = normalizeBowDataPayload(account);
        const hasAccountSyncData = !!(
          account.preferences ||
          account.goals ||
          account.savedLocations ||
          account.bowProfiles ||
          account.activeBowId ||
          account.bows
        );
        return json(
          {
            ok: true,
            preferences: normalized.preferences,
            goals: normalized.goals,
            savedLocations,
            bowProfiles: bowData.bowProfiles,
            activeBowId: bowData.activeBowId,
            bows: bowData.bows,
            hasAccountSyncData
          },
          200,
          origin
        );
      }

      if (path === '/account/preferences' && request.method === 'PATCH') {
        const account = await verifyAuth(request, env);
        if (!account) return err('Unauthorised', 401, origin);

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') return err('Invalid body', 400, origin);

        const normalized = normalizePreferencesPayload(body);
        const savedLocations = normalizeSavedLocationsPayload(body.savedLocations);
        const bowData = normalizeBowDataPayload(body);
        await env.ARCHERY_KV.put(
          `account:${account.username.toLowerCase()}`,
          JSON.stringify({
            ...account,
            preferences: normalized.preferences,
            goals: normalized.goals,
            savedLocations,
            bowProfiles: bowData.bowProfiles,
            activeBowId: bowData.activeBowId,
            bows: bowData.bows
          })
        );

        return json(
          {
            ok: true,
            preferences: normalized.preferences,
            goals: normalized.goals,
            savedLocations,
            bowProfiles: bowData.bowProfiles,
            activeBowId: bowData.activeBowId,
            bows: bowData.bows
          },
          200,
          origin
        );
      }

      const accountDeleteMatch = path.match(/^\/account\/(.+)$/);
      if (accountDeleteMatch && request.method === 'DELETE') {
        const username = decodeURIComponent(accountDeleteMatch[1]).trim();
        const body = await request.json().catch(() => null);
        const account = await getAccount(env, username);
        const authorised = !!(account && body?.password && await verifyPassword(body.password, account.passwordHash));

        if (!authorised) return err('Unauthorised', 401, origin);

        await env.ARCHERY_KV.delete(`account:${username.toLowerCase()}`);

        let cursor;
        do {
          const list = await env.ARCHERY_KV.list({ prefix: 'session:', cursor });
          cursor = list.list_complete ? undefined : list.cursor;

          await Promise.all(
            list.keys.map(async ({ name }) => {
              const value = await env.ARCHERY_KV.get(name);
              if (!value) return;

              const session = JSON.parse(value);
              if ((session.archerName || '').toLowerCase() === username.toLowerCase()) {
                await env.ARCHERY_KV.delete(name);
              }
            })
          );
        } while (cursor);

        return json({ ok: true }, 200, origin);
      }

      // --- Read All Sessions (Club History) ---
      if (path === '/sessions' && request.method === 'GET') {
        let cursor;
        const sessions = [];

        do {
          const list = await env.ARCHERY_KV.list({ prefix: 'session:', cursor });
          cursor = list.list_complete ? undefined : list.cursor;

          const chunk = await Promise.all(
            list.keys.map(async ({ name }) => {
              const value = await env.ARCHERY_KV.get(name);
              return value ? JSON.parse(value) : null;
            })
          );

          sessions.push(...chunk.filter(Boolean));
        } while (cursor);

        return json(sessions, 200, origin);
      }

      // --- Read All Global Locations ---
      if (path === '/locations' && request.method === 'GET') {
        let cursor;
        const locations = [];

        do {
          const list = await env.ARCHERY_KV.list({ prefix: 'location:', cursor });
          cursor = list.list_complete ? undefined : list.cursor;

          const chunk = await Promise.all(
            list.keys.map(async ({ name }) => {
              const value = await env.ARCHERY_KV.get(name);
              return value ? JSON.parse(value) : null;
            })
          );

          locations.push(...chunk.filter(Boolean));
        } while (cursor);

        return json(locations, 200, origin);
      }

      // --- Protected Routes Below This Point ---
      const account = await verifyAuth(request, env);
      if (!account) return err('Unauthorised', 401, origin);

      // --- Session Management ---
      if (path === '/sessions' && request.method === 'POST') {
        const session = await request.json().catch(() => null);
        if (!session?.id) return err('session.id required', 400, origin);

        if ((session.archerName || '').toLowerCase() !== account.username.toLowerCase()) {
          return err('Unauthorised: archerName mismatch', 401, origin);
        }

        const existing = await env.ARCHERY_KV.get(`session:${session.id}`);
        if (existing) {
          const stored = JSON.parse(existing);
          if ((stored.archerName || '').toLowerCase() !== account.username.toLowerCase()) {
            return err('Unauthorised: Cannot overwrite another user\'s session', 401, origin);
          }
        }

        await env.ARCHERY_KV.put(`session:${session.id}`, JSON.stringify(session));
        return json({ ok: true }, 200, origin);
      }

      const sessionMatch = path.match(/^\/sessions\/(.+)$/);
      if (sessionMatch && request.method === 'PATCH') {
        const sessionId = sessionMatch[1];
        const existing = await env.ARCHERY_KV.get(`session:${sessionId}`);
        if (!existing) return err('Not found', 404, origin);

        const stored = JSON.parse(existing);
        if ((stored.archerName || '').toLowerCase() !== account.username.toLowerCase()) {
          return err('Unauthorised: Cannot modify another user\'s session', 401, origin);
        }

        const replacement = await request.json().catch(() => null);
        if (!replacement) return err('Invalid body', 400, origin);

        if ((replacement.archerName || '').toLowerCase() !== account.username.toLowerCase()) {
          return err('Unauthorised: archerName mismatch on updated session', 401, origin);
        }

        await env.ARCHERY_KV.put(`session:${sessionId}`, JSON.stringify(replacement));
        return json({ ok: true }, 200, origin);
      }

      if (sessionMatch && request.method === 'DELETE') {
        const sessionId = sessionMatch[1];
        const existing = await env.ARCHERY_KV.get(`session:${sessionId}`);
        if (!existing) return json({ ok: true }, 200, origin);

        const stored = JSON.parse(existing);
        const isOwner = (stored.archerName || '').toLowerCase() === account.username.toLowerCase();

        if (!isOwner) {
          return err('Unauthorised: Cannot delete another user\'s session', 401, origin);
        }

        await env.ARCHERY_KV.delete(`session:${sessionId}`);
        return json({ ok: true }, 200, origin);
      }

      // --- Location Management ---
      if (path === '/locations' && request.method === 'POST') {
        const location = await request.json().catch(() => null);
        if (!location?.id) return err('location.id required', 400, origin);

        await env.ARCHERY_KV.put(`location:${location.id}`, JSON.stringify(location));
        return json({ ok: true }, 200, origin);
      }

      const locationMatch = path.match(/^\/locations\/(.+)$/);
      if (locationMatch && request.method === 'PATCH') {
        const locationId = locationMatch[1];
        const existing = await env.ARCHERY_KV.get(`location:${locationId}`);
        if (!existing) return err('Not found', 404, origin);

        const replacement = await request.json().catch(() => null);
        if (!replacement) return err('Invalid body', 400, origin);

        // Optional: Ensure the ID in the payload matches the route
        if (replacement.id && replacement.id !== locationId) {
            replacement.id = locationId; 
        }

        await env.ARCHERY_KV.put(`location:${locationId}`, JSON.stringify(replacement));
        return json({ ok: true }, 200, origin);
      }

      if (locationMatch && request.method === 'DELETE') {
        const locationId = locationMatch[1];
        await env.ARCHERY_KV.delete(`location:${locationId}`);
        return json({ ok: true }, 200, origin);
      }

      return err('Not found', 404, origin);
    } catch (error) {
      return err(error?.message || 'Internal server error', 500, origin);
    }
  }
};

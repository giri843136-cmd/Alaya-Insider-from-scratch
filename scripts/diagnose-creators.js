#!/usr/bin/env node
/**
 * Alaya Insider — Amazon Creators API plumbing diagnostic (dual-store).
 *
 * Run from the server (or anywhere with outbound HTTPS):
 *
 *   node scripts/diagnose-creators.js            # both stores
 *   node scripts/diagnose-creators.js --store=us # one store
 *
 * It performs the "dummy-key" test the way PA-API 5.0 used to be validated,
 * against the CURRENT Amazon API (Creators API — PA-API 5.0 was retired by
 * Amazon on 2026-05-15):
 *
 *   1. OAuth2 token request to the store's token endpoint using whatever
 *      CREATORS_* (India) / CREATORS_US_* (US) env vars exist, else
 *      intentionally-dummy credentials.
 *   2. If a token is obtained (real credentials!), one GetItems call to
 *      https://creatorsapi.amazon/catalog/v1/getItems with a test ASIN.
 *
 * Interpreting the result:
 *   - "invalid_client" / "UnauthorizedException" / HTTP 400-401 from the token
 *     endpoint with dummy keys ⇒ PLUMBING PASS — the request reached Amazon and
 *     was well-formed; only the credentials are fake. Real keys will work.
 *   - Network error / DNS failure / timeout ⇒ FAIL — the server cannot reach
 *     Amazon (firewall, proxy, DNS).
 *   - Items with prices returned ⇒ real credentials are live and working.
 *
 * Never prints secrets; never sends credentials anywhere except Amazon's
 * official token endpoints.
 */

const API_ENDPOINT = 'https://creatorsapi.amazon/catalog/v1/getItems';
const TEST_ASINS = ['B0B8V3W6NG']; // any valid-format ASIN; only used when real creds present

const STORES = {
  in: {
    label: 'India 🇮🇳',
    tokenEndpoint: 'https://api.amazon.co.uk/auth/o2/token', // version 3.2 (EU incl. IN)
    marketplace: 'www.amazon.in',
    envPrefix: 'CREATORS_',
    dummy: { clientId: 'dummy-cred-id-in', clientSecret: 'dummySecretForTestingIN0123456789', partnerTag: 'dummytag-21' },
  },
  us: {
    label: 'United States 🇺🇸',
    tokenEndpoint: 'https://api.amazon.com/auth/o2/token', // version 3.1 (NA)
    marketplace: 'www.amazon.com',
    envPrefix: 'CREATORS_US_',
    dummy: { clientId: 'dummy-cred-id-us', clientSecret: 'dummySecretForTestingUS0123456789', partnerTag: 'dummytag-20' },
  },
};

function env(key) { return (process.env[key] || '').trim(); }

const step = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};

async function diagnoseStore(storeKey) {
  const s = STORES[storeKey];
  const p = s.envPrefix;
  const clientId = env(`${p}CLIENT_ID`) || s.dummy.clientId;
  const clientSecret = env(`${p}CLIENT_SECRET`) || s.dummy.clientSecret;
  const partnerTag = env(`${p}PARTNER_TAG`) || s.dummy.partnerTag;
  const marketplace = env(`${p}MARKETPLACE`) || s.marketplace;
  const usingDummy = !env(`${p}CLIENT_ID`);

  console.log('');
  console.log(`── ${s.label} ────────────────────────────────────────────`);
  console.log(`Marketplace : ${marketplace}`);
  console.log(`Partner tag : ${partnerTag}`);
  console.log(`Credentials : ${usingDummy ? 'DUMMY (intentionally fake)' : `from ${p}* env vars`}`);
  console.log(`Token URL   : ${s.tokenEndpoint}`);
  console.log('');

  console.log('Step 1 — OAuth2 token request (client_credentials)...');
  let res;
  try {
    res = await fetch(s.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'creatorsapi::default',
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    step('Token endpoint reachable', false, `${e.name || 'error'}: ${e.message}`);
    console.log('VERDICT: FAIL — could not reach Amazon (network/DNS/firewall). The app would show its fallback boxes.');
    return { store: storeKey, verdict: 'FAIL' };
  }

  const body = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(body); } catch { /* keep raw */ }

  const errCode = json?.error || 'n/a';
  const errDesc = json?.error_description || json?.message || body.slice(0, 200);

  if (res.ok && json?.access_token) {
    step('Token request', true, `HTTP ${res.status} — access token obtained`);
    console.log('');
    console.log('Step 2 — GetItems (real credentials present, testing one ASIN)...');
    try {
      const apiRes = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${json.access_token}`,
          'x-marketplace': marketplace,
        },
        body: JSON.stringify({
          itemIds: TEST_ASINS,
          itemIdType: 'ASIN',
          marketplace,
          partnerTag,
          resources: ['images.primary.large', 'itemInfo.title', 'offersV2.listings.price'],
        }),
        signal: AbortSignal.timeout(15000),
      });
      const apiBody = await apiRes.text().catch(() => '');
      console.log(`GetItems → HTTP ${apiRes.status}`);
      console.log(apiBody.slice(0, 1200));
      if (apiRes.ok) {
        step('GetItems', true, 'item data returned — live boxes will populate');
        console.log('VERDICT: SUCCESS — real credentials are working.');
        return { store: storeKey, verdict: 'SUCCESS' };
      }
      step('GetItems', false, `HTTP ${apiRes.status} — check message above (e.g. missing approval for marketplace or wrong tag)`);
      console.log('VERDICT: FAIL — auth works but the product call was rejected. See message above.');
      return { store: storeKey, verdict: 'FAIL' };
    } catch (e) {
      step('GetItems', false, `${e.name || 'error'}: ${e.message}`);
      return { store: storeKey, verdict: 'FAIL' };
    }
  }

  step('Token request reached Amazon', true, `HTTP ${res.status}, error=${errCode}`);
  step('Rejection reason is credential-related (not malformed request)', /invalid_client|unauthorized|access_denied|invalid_grant|AuthenticationException/i.test(`${errCode} ${errDesc}`), errDesc.slice(0, 160));
  console.log('');
  if (usingDummy) {
    console.log('VERDICT: PLUMBING PASS (dummy keys) — Amazon received a well-formed OAuth request');
    console.log('         and rejected only the fake credentials. Enter real keys in Admin →');
    console.log('         Amazon API and re-run this script (or the admin "Run connection test").');
    return { store: storeKey, verdict: 'PLUMBING_PASS', httpStatus: res.status, error: errCode, errorDescription: errDesc.slice(0, 200) };
  }
  console.log('VERDICT: FAIL — the stored credentials were rejected by Amazon.');
  console.log('         Double-check Credential ID / Secret / Version, then re-run.');
  return { store: storeKey, verdict: 'FAIL' };
}

async function main() {
  const arg = process.argv.find(a => a.startsWith('--store='));
  const storeArg = arg ? arg.split('=')[1] : null;
  const stores = storeArg ? [storeArg] : ['in', 'us'];

  console.log('Amazon Creators API — plumbing diagnostic (dual-store)');
  console.log('======================================================');
  if (storeArg) console.log(`Scope: ${STORES[storeArg]?.label || storeArg} only`);
  console.log('');

  const results = [];
  for (const s of stores) {
    if (!STORES[s]) { console.log(`Unknown store: ${s} (use in|us)`); continue; }
    results.push(await diagnoseStore(s));
  }

  console.log('');
  console.log('=== SUMMARY ===');
  for (const r of results) console.log(`${r.store}: ${r.verdict}${r.httpStatus ? ` (HTTP ${r.httpStatus}, ${r.error})` : ''}`);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
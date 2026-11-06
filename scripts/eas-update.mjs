#!/usr/bin/env node
/**
 * Publish an OTA update with the same env as the matching EAS build profile.
 *
 *   npm run update:production -- "Fix headline copy"
 *
 * Why: `eas update` bundles on this machine, and Metro inlines EXPO_PUBLIC_* from the local environment / .env at
 * that moment. Taking EXPO_PUBLIC_* (and the channel) from `eas.json` → build.<profile> guarantees an update never
 * points a build at a different API than the one it was built with.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [profile, ...msg] = process.argv.slice(2);
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const p = eas.build?.[profile];
if (!p || !p.channel) {
  console.error(`Usage: eas-update.mjs <profile> [message]. Profiles with a channel: ${Object.keys(eas.build).filter((k) => eas.build[k].channel).join(', ')}`);
  process.exit(1);
}
const env = Object.fromEntries(Object.entries(p.env || {}).filter(([k]) => k.startsWith('EXPO_PUBLIC_')));
if (!env.EXPO_PUBLIC_API_URL) {
  console.error(`eas.json build.${profile}.env has no EXPO_PUBLIC_API_URL`);
  process.exit(1);
}
const message = msg.join(' ') || `${profile} update`;
console.log(`Channel ${p.channel} · ${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ')}`);
const r = spawnSync('npx', ['eas-cli@latest', 'update', '--channel', p.channel, '--environment', profile, '--message', message], {
  stdio: 'inherit',
  env: { ...process.env, ...env },
});
process.exit(r.status ?? 1);

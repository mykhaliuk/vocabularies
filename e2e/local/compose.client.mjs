import { chromium } from '@playwright/test';
import { sendFrom } from './helpers.mjs';

// Local-only UI tests for the compose write path (VKB-67): the sheet posts a
// word (text-only and with a small voice fixture), the feed shows it without
// a reload, and the composed processing entry is polled to `ready` by the
// feed itself — which is the postedVersion → mergeFirstPage → processingKey
// restart chain end to end. The free-tier video gate is exercised against the
// real server verdict (403 VIDEO_UPLOAD_FORBIDDEN), not a client guess.
// NOT part of the CI e2e suite (needs a DB + MinIO + the inline transcode
// path) — see e2e/local/README. Invoked by e2e/local/run.mjs with
// { base, findLink }.

const EN = { locale: 'en-US' };

// Minimal real WAV: RIFF header + 1s of 8kHz 16-bit mono silence. Generated
// here so the repo carries no binary fixture; ffmpeg reads it fine.
const makeWavFixture = () => {
  const sampleRate = 8000;
  const seconds = 1;
  const dataSize = sampleRate * seconds * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
};

export const run = async ({ base, findLink }) => {
  let passed = 0;
  let failed = 0;
  const check = (name, cond, extra = '') => {
    if (cond) passed++;
    else failed++;
    console.log(
      `  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`,
    );
  };

  const browser = await chromium.launch();
  try {
    // -- sign in through the desktop magic-link path (a fresh free user) --
    const ctx = await browser.newContext(EN);
    const page = await ctx.newPage();
    const email = `compose-${Date.now()}@example.com`;
    await sendFrom(page, base, email);
    const link = await findLink(email);
    await page.goto(link);
    try {
      await page.waitForURL('**/feed', { timeout: 15000 });
    } catch {
      // assertion reports the actual URL
    }
    check(
      'the magic link signs in and lands on /feed',
      new URL(page.url()).pathname === '/feed',
      page.url(),
    );

    // Count the feed's own /api/entries GETs so the poll leaves evidence.
    let feedFetches = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/entries'
      ) {
        feedFetches++;
      }
    });

    const fab = page.getByRole('button', { name: /new word/i });
    const sheet = page.locator('.compose--open');
    const keep = page.getByRole('button', { name: /^keep$/i });

    // Click-and-confirm with retries: right after navigation the FAB exists
    // in the DOM before hydration attaches its listener, so a single early
    // click lands on nothing (the /login fill has the same guard).
    const openSheet = async () => {
      for (let attempt = 0; attempt < 15; attempt++) {
        await fab.click();
        try {
          await sheet.waitFor({ state: 'visible', timeout: 1000 });
          return true;
        } catch {
          // not hydrated yet — click again
        }
      }
      return false;
    };

    console.log('\n== speakers: first run, inline creation, frozen age ==');
    check('the FAB opens the compose sheet', await openSheet());
    // A fresh account has no speakers: the row must teach the mechanic by
    // showing only "＋ someone new" (speaker-spec §Edges).
    check(
      'first-run chip row shows only someone-new',
      (await page.locator('.chips__chip').count()) === 1 &&
        (await page.getByRole('button', { name: /someone new/i }).count()) ===
          1,
    );

    await page.getByRole('button', { name: /someone new/i }).click();
    await page.locator('.chips__panel').waitFor({ timeout: 5000 });
    check(
      'add is disabled until the name has content',
      await page.getByRole('button', { name: /^add$/i }).isDisabled(),
    );
    await page.fill('#speaker-name', 'Mira');
    await page
      .locator('.chips__suggestions')
      .getByRole('button', { name: /^my daughter$/i })
      .click();
    check(
      'a suggestion chip fills the relation',
      (await page.locator('#speaker-rel').inputValue()) === 'my daughter',
    );
    const MIRA_BIRTHDAY = '2024-09-14';
    await page.fill('#speaker-birthday', MIRA_BIRTHDAY);
    await page.getByRole('button', { name: /^add$/i }).click();
    let chipSelected = true;
    try {
      await page
        .locator('.chips__chip--active', { hasText: 'Mira' })
        .waitFor({ timeout: 10000 });
    } catch {
      chipSelected = false;
    }
    check('add creates the person and selects their chip', chipSelected);

    await page.fill('#compose-word', 'nana-lella');
    await keep.click();
    try {
      await sheet.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // assertion reports the state
    }
    // The frozen age: whole calendar months against saidAt (= today for a
    // fresh post), computed here from the same dates so the assertion does
    // not rot as time passes.
    const now = new Date();
    const born = new Date(MIRA_BIRTHDAY + 'T00:00:00Z');
    let expectMo =
      (now.getUTCFullYear() - born.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - born.getUTCMonth());
    if (now.getUTCDate() < born.getUTCDate()) expectMo -= 1;
    const expectAge =
      expectMo < 24 ? `${expectMo} mo` : `${Math.floor(expectMo / 12)} y`;
    const miraCard = page.locator('.entry', { hasText: 'nana-lella' });
    let miraMeta = '';
    try {
      await miraCard.waitFor({ timeout: 10000 });
      miraMeta = (await miraCard.locator('.entry__speaker').innerText())
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      // assertion reports the meta line
    }
    check(
      'the meta line reads name · relation · frozen age',
      miraMeta === `Mira · my daughter · ${expectAge}`,
      miraMeta,
    );

    console.log('\n== text-only happy path, attributed to You ==');
    check('the sheet reopens', await openSheet());
    await page.fill('#compose-word', 'appo');
    await page.fill('#compose-gloss', 'apple');
    // No chip selected on purpose: attribution never blocks the word.
    await keep.click();
    try {
      await sheet.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {
      // assertion reports the state
    }
    check('keep closes the sheet', !(await sheet.isVisible()));
    let seen = true;
    let appoMeta = '';
    try {
      const appoCard = page.locator('.entry', { hasText: 'appo' }).first();
      await appoCard.waitFor({ timeout: 10000 });
      appoMeta = (await appoCard.locator('.entry__speaker').innerText()).trim();
    } catch {
      seen = false;
    }
    check('the composed word appears in the feed without a reload', seen);
    check('an unattributed word reads You', appoMeta === 'You', appoMeta);

    console.log('\n== voice-clip happy path (small fixture) ==');
    const beforeVoice = feedFetches;
    check('the sheet reopens for the voice clip', await openSheet());
    await page.fill('#compose-word', 'appo voice');
    await page.setInputFiles('input.attach__input', {
      name: 'clip.wav',
      mimeType: 'audio/wav',
      buffer: makeWavFixture(),
    });
    let kept = true;
    try {
      await page.getByText(/voice kept/i).waitFor({ timeout: 5000 });
    } catch {
      kept = false;
    }
    check('a picked voice clip is confirmed as kept', kept);

    await keep.click();
    try {
      await sheet.waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // assertion reports the state
    }
    check(
      'keep uploads the clip and closes the sheet',
      !(await sheet.isVisible()),
    );

    // The card must reach `ready` (the audio row renders) with NO reload:
    // only the feed's own merge + restarted poll can get it there.
    const voiceCard = page.locator('.entry', { hasText: 'appo voice' });
    let ready = true;
    try {
      await voiceCard.locator('.audio__row').waitFor({ timeout: 90000 });
    } catch {
      ready = false;
    }
    check('the voice entry flips to ready in place (poll, no reload)', ready);
    const pollFetches = feedFetches - beforeVoice;
    check(
      'the composed entry restarted the feed poll (>= 2 /api/entries GETs)',
      pollFetches >= 2,
      `${pollFetches} GETs`,
    );

    console.log('\n== free tier: the video gate is the server, not a guess ==');
    check('the sheet reopens for the video attempt', await openSheet());
    check(
      'the free picker accepts audio only',
      (await page.locator('input.attach__input').getAttribute('accept')) ===
        'audio/*',
    );
    check(
      'the video gate is stated before it can be hit',
      await page
        .getByText(/video moments are premium/i)
        .first()
        .isVisible(),
    );

    await page.fill('#compose-word', 'appo video');
    // Fake bytes: the metadata probe fails open (the server still checks),
    // so the pick is accepted locally and the verdict comes from POST.
    await page.setInputFiles('input.attach__input', {
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('vocabu-fake-video-bytes'),
    });
    try {
      await page.getByText(/video kept/i).waitFor({ timeout: 5000 });
    } catch {
      // assertion below reports through the failure branch instead
    }
    await keep.click();
    let refused = true;
    try {
      await page.getByText(/that one's a video/i).waitFor({ timeout: 15000 });
    } catch {
      refused = false;
    }
    check(
      'the server refuses a free-tier video with the premium branch',
      refused,
    );

    const upsell = page.locator('.upsell__sheet');
    let pitched = true;
    try {
      await page
        .locator('.attach__acts')
        .getByRole('button', { name: /see premium/i })
        .click();
      await upsell.getByText(/voice is always yours/i).waitFor({
        timeout: 5000,
      });
    } catch {
      pitched = false;
    }
    check('the premium sheet opens with the pitch', pitched);

    let soon = true;
    try {
      await upsell.getByRole('button', { name: /see premium/i }).click();
      await upsell.getByText(/coming soon/i).waitFor({ timeout: 5000 });
    } catch {
      soon = false;
    }
    check('the premium CTA reaches the coming-soon stage', soon);

    let cleaned = true;
    try {
      await upsell.getByRole('button', { name: /close/i }).click();
      await page.getByRole('button', { name: /cancel/i }).click();
      await sheet.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      cleaned = false;
    }
    check('cancel leaves the failed attempt cleanly', cleaned);

    await ctx.close();
  } finally {
    await browser.close();
  }

  return { passed, failed };
};

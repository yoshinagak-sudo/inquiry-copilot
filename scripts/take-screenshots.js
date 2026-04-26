// 概要書用スクショ自動取得スクリプト（テンプレ）
// 使い方:
//   SCREENSHOT_BASE_URL="https://example.com" node scripts/take-screenshots.js
// 出力: docs/screenshots/*.png

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'https://example.com';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// ビューポート
const MOBILE_VP = { width: 390, height: 844 };       // iPhone 14 Pro 相当
const DESKTOP_VP = { width: 1440, height: 900 };

// === 撮影対象ページ ===
const NEW_INQUIRY_ID = 'cmofjokls000goordhgl05z3n'; // 未送信（草案編集）— 白米10kg注文
const SENT_INQUIRY_ID = 'cmofjokm6000yoord2ez8pbse'; // 送信済み — 保育園野菜デリバリー

const PAGES = [
  // デスクトップ
  { name: 'desktop-inbox', path: '/', device: 'desktop', fullPage: true, waitMs: 800 },
  { name: 'desktop-inquiry-detail', path: `/inquiries/${NEW_INQUIRY_ID}`, device: 'desktop', fullPage: true, waitMs: 1500 },
  { name: 'desktop-inquiry-sent', path: `/inquiries/${SENT_INQUIRY_ID}`, device: 'desktop', fullPage: true, waitMs: 1000 },
  { name: 'desktop-knowledge', path: '/knowledge', device: 'desktop', fullPage: true, waitMs: 800 },
  { name: 'desktop-candidates', path: '/knowledge/candidates', device: 'desktop', fullPage: true, waitMs: 800 },

  // モバイル
  { name: 'mobile-inbox', path: '/', device: 'mobile', fullPage: false, waitMs: 800 },
  { name: 'mobile-inquiry-detail', path: `/inquiries/${NEW_INQUIRY_ID}`, device: 'mobile', fullPage: false, waitMs: 1500 },
  { name: 'mobile-knowledge', path: '/knowledge', device: 'mobile', fullPage: false, waitMs: 800 },
  { name: 'mobile-candidates', path: '/knowledge/candidates', device: 'mobile', fullPage: false, waitMs: 800 },
];

async function shoot(ctx, page, p) {
  const url = `${BASE_URL.replace(/\/$/, '')}${p.path}`;
  console.log(`  → ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(p.waitMs || 500);

  // 任意のクリック等のアクション
  if (p.actions) {
    for (const a of p.actions) {
      if (a.click) {
        const el = page.locator(a.click).first();
        if (await el.isVisible().catch(() => false)) {
          await el.click();
          await page.waitForTimeout(500);
        }
      }
      if (a.wait) await page.waitForTimeout(a.wait);
    }
  }

  const file = path.join(OUT_DIR, `${p.name}.png`);
  await page.screenshot({ path: file, fullPage: !!p.fullPage });
  console.log(`  ✓ ${p.name}.png`);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`[base] ${BASE_URL}`);
  const browser = await chromium.launch();

  // モバイルコンテキスト
  const mobileCtx = await browser.newContext({
    viewport: MOBILE_VP,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  // デスクトップコンテキスト
  const desktopCtx = await browser.newContext({
    viewport: DESKTOP_VP,
    deviceScaleFactor: 2,
  });

  for (const p of PAGES) {
    const ctx = p.device === 'mobile' ? mobileCtx : desktopCtx;
    const page = await ctx.newPage();
    try {
      await shoot(ctx, page, p);
    } catch (e) {
      console.error(`  ✗ ${p.name}: ${e.message}`);
    } finally {
      await page.close();
    }
  }

  await mobileCtx.close();
  await desktopCtx.close();
  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

const { chromium } = require('playwright');
const path = require('path');

async function check() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(__dirname, 'current_screen.png') });
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Title:', title);
  console.log('Body start:', bodyText);
  await browser.close();
}
check();

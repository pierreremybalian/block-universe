// Frame-rate probe: loads each scene in the dev harness, lets it settle, then counts frames over 3 s with vsync off.
// Headless numbers are an upper bound (GPU work is queued, not timed); use them to compare scenes, not as real fps.
// Usage: node scripts/fps.ts [--base http://localhost:4350] [--tier medium] [--webgl] [--locals 0.3,0.7]
import { chromium } from 'playwright';
import { STAGES } from '../src/time/stages.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? (args[i + 1] ?? d) : d;
};
const base = opt('base', 'http://localhost:4350');
const tier = opt('tier', 'medium');
const webgl = args.includes('--webgl');
const locals = opt('locals', '0.3,0.7').split(',');
const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (const st of STAGES) {
  const row: string[] = [];
  for (const l of locals) {
    await page.goto(`${base}/dev/scenes/?scene=${st.sceneId}&local=${l}&ui=0&tier=${tier}&frames=20${webgl ? '&webgl=1' : ''}`);
    await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
    const f0 = await page.evaluate('window.__engine.frames()');
    await page.waitForTimeout(3000);
    const f1 = await page.evaluate('window.__engine.frames()');
    row.push(`${l}: ${(((f1 as number) - (f0 as number)) / 3).toFixed(0)} fps`);
  }
  console.log(`${st.id.padEnd(10)} ${row.join('   ')}`);
}
await browser.close();

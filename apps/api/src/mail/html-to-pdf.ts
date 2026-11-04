import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

function resolveBrowser(): string {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Chrome/Edge not found. Install Google Chrome or set CHROME_PATH in apps/api/.env',
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Render HTML to PDF using system Chrome/Edge headless (same engine as browser print).
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = resolveBrowser();
  const dir = await mkdtemp(join(tmpdir(), 'courier-html-pdf-'));
  const htmlPath = join(dir, 'document.html');
  const pdfPath = join(dir, 'document.pdf');

  try {
    await writeFile(htmlPath, html, 'utf8');
    const fileUrl = pathToFileURL(htmlPath).href;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        browser,
        [
          '--headless=new',
          '--disable-gpu',
          '--allow-file-access-from-files',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdfPath}`,
          fileUrl,
        ],
        {
          stdio: 'ignore',
          windowsHide: true,
        },
      );
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Browser PDF export failed (exit ${code})`));
      });
    });

    // Chrome may exit slightly before the PDF flush completes
    for (let i = 0; i < 20; i++) {
      if (existsSync(pdfPath)) {
        const buf = await readFile(pdfPath);
        if (buf.length > 500) return buf;
      }
      await sleep(100);
    }
    throw new Error('PDF file was not created by Chrome/Edge');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

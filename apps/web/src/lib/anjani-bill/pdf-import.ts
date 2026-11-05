import { formatAmount } from './calc';
import { buildLayout, emptyPageLayout, type OcrWord } from './layout';
import { parseInvoice } from './parse';
import type { BBox, PageLayout, SourcePage } from './stamp';
import type { AnjaniBillForm, AnjaniLineRow } from './types';
import { blankRow } from './types';

function findHeaderRule(canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const width = canvas.width;
  const height = canvas.height;
  const x0 = Math.floor(width * 0.06);
  const span = Math.floor(width * 0.88);
  const y0 = Math.floor(height * 0.05);
  const y1 = Math.floor(height * 0.34);
  for (let y = y0; y < y1; y += 2) {
    const row = ctx.getImageData(x0, y, span, 1).data;
    let dark = 0;
    const total = Math.floor(span / 4);
    for (let x = 0; x < span; x += 4) {
      const i = x * 4;
      if (row[i] < 90 && row[i + 1] < 90 && row[i + 2] < 90) dark += 1;
    }
    if (total > 0 && dark / total > 0.62) return y;
  }
  return null;
}

export function cropHeader(canvas: HTMLCanvasElement): string {
  const rule = findHeaderRule(canvas);
  if (!rule) return '';
  const slice = document.createElement('canvas');
  slice.width = canvas.width;
  slice.height = Math.min(canvas.height, rule + 3);
  const ctx = slice.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(
    canvas,
    0,
    0,
    canvas.width,
    slice.height,
    0,
    0,
    canvas.width,
    slice.height,
  );
  return slice.toDataURL('image/jpeg', 0.9);
}

async function textFromPdfPage(page: {
  getTextContent: () => Promise<{ items: unknown[] }>;
}): Promise<string> {
  const content = await page.getTextContent();
  const items = content.items.filter(
    (item): item is { str: string; transform: number[] } => {
      const t = item as { str?: string; transform?: number[] };
      return Boolean(t.str?.trim() && Array.isArray(t.transform));
    },
  );
  if (!items.length) return '';
  const rows: Array<{ y: number; parts: Array<{ x: number; str: string }> }> =
    [];
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    let row = rows.find((entry) => Math.abs(entry.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], str: item.str || '' });
  });
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(' '),
    )
    .join('\n');
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (message: string) => void,
  label = 'OCR',
): Promise<{ text: string; words: OcrWord[] }> {
  const Tesseract = (await import('tesseract.js')).default;
  const result = await Tesseract.recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(
          `${label}: ${Math.round((m.progress || 0) * 100)}%`,
        );
      }
    },
  });
  const data = result.data as {
    text?: string;
    words?: Array<{ text?: string; bbox?: BBox }>;
  };
  const words: OcrWord[] = (data.words || [])
    .filter(
      (word: { text?: string; bbox?: BBox }) =>
        word?.bbox && String(word.text || '').trim(),
    )
    .map((word: { text?: string; bbox?: BBox }) => ({
      text: String(word.text || ''),
      bbox: {
        x0: word.bbox!.x0,
        y0: word.bbox!.y0,
        x1: word.bbox!.x1,
        y1: word.bbox!.y1,
      },
    }));
  return { text: data.text || '', words };
}

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.92);
}

function filled(value: unknown) {
  return String(value || '').trim();
}

function firstFilled<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T,
) {
  const found = items.find((item) => filled(item[key]));
  return found ? String(found[key] ?? '') : '';
}

function lastFilled<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T,
) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (filled(items[index][key])) return String(items[index][key] ?? '');
  }
  return '';
}

export type LayoutJson = {
  pages: PageLayout[];
};

export type PdfImportResult = {
  formPatch: Partial<AnjaniBillForm>;
  rows: AnjaniLineRow[];
  headerImageDataUrl: string;
  pageCount: number;
  sourcePages: SourcePage[];
  layoutJson: LayoutJson | null;
  stampReady: boolean;
};

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

async function renderPagesFromData(
  data: Uint8Array,
  options: {
    onProgress?: (message: string) => void;
    /** When set, skip OCR and pair rendered pages with saved layouts */
    savedLayouts?: PageLayout[];
    fileName?: string;
    /** Return page images even when OCR layout count does not match rows */
    keepPages?: boolean;
  } = {},
): Promise<PdfImportResult> {
  const {
    onProgress,
    savedLayouts,
    fileName = 'invoice.pdf',
    keepPages = false,
  } = options;
  onProgress?.('Opening PDF…');
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const bundles: Array<{
    imageDataUrl: string;
    width: number;
    height: number;
    layout: PageLayout;
    parsed: ReturnType<typeof parseInvoice>;
  }> = [];
  let headerImageDataUrl = '';
  let fullText = '';

  for (let i = 1; i <= pageCount; i += 1) {
    onProgress?.(`Rendering page ${i} of ${pageCount}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    if (i === 1) headerImageDataUrl = cropHeader(canvas);

    const pdfText = await textFromPdfPage(page);
    let layout = savedLayouts?.[i - 1] || emptyPageLayout();
    let pageText = pdfText;

    if (!savedLayouts) {
      // Always OCR so we get exact field boxes for stamp-on-original export
      onProgress?.(`OCR page ${i} of ${pageCount}…`);
      try {
        const read = await ocrCanvas(
          canvas,
          onProgress,
          `OCR page ${i}/${pageCount}`,
        );
        pageText = read.text || pdfText;
        layout = buildLayout(read.words);
      } catch {
        if (pdfText.replace(/\s/g, '').length >= 40) {
          pageText = pdfText;
        }
      }
    } else if (pdfText.replace(/\s/g, '').length < 40) {
      try {
        const read = await ocrCanvas(
          canvas,
          onProgress,
          `OCR page ${i}/${pageCount}`,
        );
        pageText = read.text || pdfText;
      } catch {
        // keep pdf text
      }
    }

    fullText += `\n${pageText}`;
    const parsed = parseInvoice(pageText || fullText);
    bundles.push({
      imageDataUrl: canvasToDataUrl(canvas),
      width: canvas.width,
      height: canvas.height,
      layout,
      parsed,
    });
    canvas.width = 0;
    canvas.height = 0;
  }

  const layoutRows = bundles.flatMap((b) => b.layout.dataRows || []);
  const parsedAll = parseInvoice(fullText);
  const headers = bundles.map((b) => b.parsed as Record<string, unknown>);
  const fuelFromBox = bundles.reduce((found, bundle) => {
    const spot = bundle.layout.fuel;
    return spot?.value ? formatAmount(spot.value) : found;
  }, '');

  const rowsSource = layoutRows.length ? layoutRows : parsedAll.rows || [];
  const rows = rowsSource.map((r, idx) => ({
    ...blankRow(`r${idx + 1}`),
    ...r,
  }));

  const sourcePages: SourcePage[] = bundles.map((bundle) => ({
    imageDataUrl: bundle.imageDataUrl,
    width: bundle.width,
    height: bundle.height,
    layout: bundle.layout,
  }));

  const placed = sourcePages.reduce(
    (sum, page) => sum + (page.layout.rows?.length || 0),
    0,
  );
  const stampReady = placed > 0 && placed === rows.length;
  const keep = keepPages || stampReady;

  return {
    formPatch: {
      customerName:
        firstFilled(headers, 'customerName') || parsedAll.customerName || '',
      address1: firstFilled(headers, 'address1') || parsedAll.address1 || '',
      address2: firstFilled(headers, 'address2') || parsedAll.address2 || '',
      customerGst:
        firstFilled(headers, 'customerGst') || parsedAll.customerGst || '',
      customerCode:
        firstFilled(headers, 'customerCode') || parsedAll.customerCode || '',
      customerPan:
        firstFilled(headers, 'customerPan') ||
        parsedAll.customerPan ||
        '-',
      billNo: firstFilled(headers, 'billNo') || parsedAll.billNo || '',
      billDate: firstFilled(headers, 'billDate') || parsedAll.billDate || '',
      billPeriod:
        firstFilled(headers, 'billPeriod') || parsedAll.billPeriod || '',
      hsn: firstFilled(headers, 'hsn') || parsedAll.hsn || '',
      fuel:
        fuelFromBox ||
        lastFilled(headers, 'fuel') ||
        parsedAll.fuel ||
        '0.00',
      bankName: lastFilled(headers, 'bankName') || parsedAll.bankName || '',
      accountNo:
        lastFilled(headers, 'accountNo') || parsedAll.accountNo || '',
      ifsc: lastFilled(headers, 'ifsc') || parsedAll.ifsc || '',
      headerImageDataUrl,
      sourcePdfFileName: fileName,
    },
    rows,
    headerImageDataUrl,
    pageCount,
    sourcePages: keep ? sourcePages : [],
    layoutJson: stampReady
      ? { pages: sourcePages.map((p) => p.layout) }
      : null,
    stampReady,
  };
}

export async function importAnjaniPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PdfImportResult> {
  onProgress?.('Loading PDF reader…');
  const data = new Uint8Array(await file.arrayBuffer());
  return renderPagesFromData(data, { onProgress, fileName: file.name });
}

/** Re-open a saved bill: render original PDF pages and attach stored OCR layout */
export async function restoreSourcePages(
  pdfUrl: string,
  layoutJson: LayoutJson | null | undefined,
  onProgress?: (message: string) => void,
): Promise<SourcePage[]> {
  if (!layoutJson?.pages?.length || !pdfUrl) return [];
  onProgress?.('Restoring original PDF pages…');
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error('Could not download original PDF');
  const buffer = new Uint8Array(await res.arrayBuffer());
  const result = await renderPagesFromData(buffer, {
    onProgress,
    savedLayouts: layoutJson.pages,
    keepPages: true,
  });
  return result.sourcePages.map((page, i) => ({
    ...page,
    layout: layoutJson.pages[i] || page.layout,
  }));
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

import { formatAmount, formatWeight } from './calc';
import type { AnjaniBillForm, AnjaniLineRow } from './types';

export type BBox = { x0: number; y0: number; x1: number; y1: number };

export type Spot = { bbox: BBox; text?: string };

export type MoneySpot = {
  bbox: BBox;
  label?: BBox | null;
  labelText?: string;
  value?: string;
};

export type RowLayout = {
  date?: Spot | null;
  docNo?: Spot | null;
  type?: Spot | null;
  party?: Spot | null;
  center?: Spot | null;
  weight?: BBox | null;
  amount?: BBox | null;
};

export type PageLayout = {
  rows: RowLayout[];
  dataRows: Array<Omit<AnjaniLineRow, 'id'>>;
  gross?: MoneySpot | null;
  fuel?: MoneySpot | null;
  sub?: MoneySpot | null;
  sgst?: MoneySpot | null;
  cgst?: MoneySpot | null;
  igst?: MoneySpot | null;
  bill?: MoneySpot | null;
  words?: BBox | null;
};

export type SourcePage = {
  imageDataUrl: string;
  width: number;
  height: number;
  layout: PageLayout;
};

const TEXT_STYLE = {
  fontFamily: 'Calibri',
  weight: { size: 14, fontWeight: 500 },
  amount: { size: 14, fontWeight: 500 },
  rowText: { size: 13, fontWeight: 400 },
  grossAmount: { size: 14, fontWeight: 400 },
  fuelSurcharge: { size: 13, fontWeight: 400 },
  subTotal: { size: 14, fontWeight: 400 },
  sgst: { size: 14, fontWeight: 400 },
  cgst: { size: 14, fontWeight: 400 },
  igst: { size: 14, fontWeight: 400 },
  billAmount: { size: 18, fontWeight: 600 },
  words: { size: 18, fontWeight: 600 },
} as const;

type StyleKey = keyof typeof TEXT_STYLE;

function normalizeUnit(value: unknown): string {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (text.startsWith('g')) return 'gm';
  return 'kg';
}

function unitLabel(unit: unknown) {
  return '(' + normalizeUnit(unit) + ')';
}

function sameText(left: unknown, right: unknown) {
  return (
    String(left || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() ===
    String(right || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

function pagePixelSize(px: number, canvas: HTMLCanvasElement) {
  return px * (canvas.width / 794);
}

function paintBox(
  ctx: CanvasRenderingContext2D,
  box: BBox,
  text: string,
  fontPx: number,
  fontWeight: number,
  alignRight: boolean,
) {
  const padY = 2;
  const padX = 4;
  ctx.save();
  ctx.font = `${fontWeight} ${fontPx}px ${TEXT_STYLE.fontFamily}`;
  const measured = ctx.measureText(text).width;
  const right = box.x1;
  const left = alignRight
    ? Math.min(box.x0, right - measured) - padX
    : box.x0 - padX;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    left,
    box.y0 - padY,
    right - left + padX,
    box.y1 - box.y0 + padY * 2,
  );
  ctx.fillStyle = '#000000';
  ctx.textAlign = alignRight ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, alignRight ? right - 1 : box.x0, (box.y0 + box.y1) / 2);
  ctx.restore();
}

function paintLeft(
  ctx: CanvasRenderingContext2D,
  box: BBox,
  text: string,
  fontPx: number,
  fontWeight: number,
  limitRight: number,
) {
  const padY = 2;
  const padX = 3;
  ctx.save();
  ctx.font = `${fontWeight} ${fontPx}px ${TEXT_STYLE.fontFamily}`;
  const measured = ctx.measureText(String(text || '')).width;
  const left = box.x0 - padX;
  const right = Math.min(
    Math.max(box.x1, box.x0 + measured) + padX,
    limitRight - 2,
  );
  const width = Math.max(4, right - left);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(left, box.y0 - padY, width, box.y1 - box.y0 + padY * 2);
  ctx.beginPath();
  ctx.rect(left, box.y0 - padY, width, box.y1 - box.y0 + padY * 2);
  ctx.clip();
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || ''), box.x0, (box.y0 + box.y1) / 2);
  ctx.restore();
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load page image'));
    img.src = dataUrl;
  });
}

export async function stampOriginalPage(
  page: SourcePage,
  rows: AnjaniLineRow[],
  form: AnjaniBillForm,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(page.imageDataUrl);
  const copy = document.createElement('canvas');
  copy.width = page.width || img.width;
  copy.height = page.height || img.height;
  const ctx = copy.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);

  const px = (key: StyleKey) => {
    const style = TEXT_STYLE[key];
    if (typeof style === 'string') return 13;
    return pagePixelSize(style.size, copy);
  };
  const weightOf = (key: StyleKey) => {
    const style = TEXT_STYLE[key];
    if (typeof style === 'string') return 400;
    return style.fontWeight;
  };

  const layout = page.layout;
  layout.rows.forEach((spot, index) => {
    const row = rows[index];
    if (!spot || !row) return;
    const textFields = ['date', 'docNo', 'type', 'party', 'center'] as const;
    textFields.forEach((key, fieldIndex) => {
      const field = spot[key];
      if (!field?.bbox || sameText(row[key], field.text)) return;
      const next = textFields
        .slice(fieldIndex + 1)
        .map((name) => spot[name]?.bbox)
        .find(Boolean);
      const limit = next
        ? next.x0
        : spot.weight
          ? spot.weight.x0
          : field.bbox.x1 + 160;
      paintLeft(
        ctx,
        field.bbox,
        row[key],
        px('rowText'),
        weightOf('rowText'),
        limit,
      );
    });
    if (spot.weight) {
      paintBox(
        ctx,
        spot.weight,
        `${formatWeight(row.weight)} ${unitLabel(row.unit)}`,
        px('weight'),
        weightOf('weight'),
        true,
      );
    }
    if (spot.amount) {
      paintBox(
        ctx,
        spot.amount,
        formatAmount(row.amount),
        px('amount'),
        weightOf('amount'),
        true,
      );
    }
  });

  const withTotals = Boolean(layout.gross || layout.bill);
  if (!withTotals) return copy;

  const figures: Array<[MoneySpot | null | undefined, string, StyleKey]> = [
    [layout.gross, form.gross, 'grossAmount'],
    [layout.fuel, form.fuel, 'fuelSurcharge'],
    [layout.sub, form.sub, 'subTotal'],
    [layout.sgst, form.sgst, 'sgst'],
    [layout.cgst, form.cgst, 'cgst'],
    [layout.igst, form.igst, 'igst'],
    [layout.bill, form.bill, 'billAmount'],
  ];
  figures.forEach(([spot, value, key]) => {
    if (!spot?.bbox) return;
    paintBox(ctx, spot.bbox, formatAmount(value), px(key), weightOf(key), true);
  });
  if (layout.words) {
    paintBox(
      ctx,
      layout.words,
      form.words,
      px('words'),
      weightOf('words'),
      true,
    );
  }
  return copy;
}

function canvasToJpegUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not prepare a page image'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () =>
          reject(reader.error || new Error('Could not read a page image'));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

export async function addCanvasPages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  canvas: HTMLCanvasElement,
) {
  const pageW = 210;
  const pageH = 297;
  const pxPerMm = canvas.width / pageW;
  const heightMm = canvas.height / pxPerMm;
  if (heightMm <= pageH + 4) {
    const scale = Math.min(1, pageH / heightMm);
    const url = await canvasToJpegUrl(canvas);
    pdf.addImage(
      url,
      'JPEG',
      (pageW - pageW * scale) / 2,
      0,
      pageW * scale,
      heightMm * scale,
      undefined,
      'FAST',
    );
    return;
  }
  const pagePx = Math.floor(pageH * pxPerMm);
  let y = 0;
  let first = true;
  while (y < canvas.height) {
    const sliceH = Math.min(pagePx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    slice
      .getContext('2d')
      ?.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    first = false;
    const url = await canvasToJpegUrl(slice);
    pdf.addImage(url, 'JPEG', 0, 0, pageW, sliceH / pxPerMm, undefined, 'FAST');
    y += sliceH;
  }
}

export function canStampOriginal(
  sourcePages: SourcePage[],
  rows: AnjaniLineRow[],
) {
  if (!sourcePages.length) return false;
  const pageRowCount = sourcePages.reduce(
    (sum, page) => sum + (page.layout?.rows?.length || 0),
    0,
  );
  return pageRowCount > 0 && pageRowCount === rows.length;
}

export async function downloadStampedPdf(
  sourcePages: SourcePage[],
  form: AnjaniBillForm,
  onProgress?: (message: string) => void,
  companyName = 'Shree Anjani Courier',
) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  let offset = 0;
  for (let index = 0; index < sourcePages.length; index += 1) {
    const page = sourcePages[index];
    const count = page.layout.rows.length;
    const slice = form.rows.slice(offset, offset + count);
    offset += count;
    onProgress?.(
      `Stamping page ${index + 1} of ${sourcePages.length}…`,
    );
    const canvas = await stampOriginalPage(page, slice, form);
    if (index > 0) pdf.addPage();
    await addCanvasPages(pdf, canvas);
    canvas.width = 0;
    canvas.height = 0;
  }
  const brand =
    String(companyName || 'Shree Anjani Courier')
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'Anjani';
  const safe = (form.billNo || 'invoice').replace(/[^\w.-]+/g, '-');
  pdf.save(`${brand}-Invoice-${safe}.pdf`);
}

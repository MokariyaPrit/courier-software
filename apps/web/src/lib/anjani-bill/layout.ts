import { formatAmount, formatWeight } from './calc';
import { parseRows } from './parse';
import type { AnjaniLineRow } from './types';
import type { BBox, MoneySpot, PageLayout, RowLayout, Spot } from './stamp';

export type OcrWord = {
  text: string;
  bbox?: BBox;
};

function cleanLine(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(value: unknown): 'kg' | 'gm' {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (text.startsWith('g')) return 'gm';
  return 'kg';
}

function splitPartyCenter(rest: string) {
  const parts = cleanLine(rest)
    .split(' ')
    .filter(Boolean);
  if (parts.length <= 1) {
    return {
      party: cleanLine(parts[0] || '').replace(
        /^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,
        '',
      ),
      center: '',
    };
  }
  return {
    party: cleanLine(parts.slice(0, -1).join(' ')).replace(
      /^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,
      '',
    ),
    center: cleanLine(parts[parts.length - 1]).replace(
      /^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,
      '',
    ),
  };
}

function unionBox(boxes: BBox[]): BBox {
  return {
    x0: Math.min(...boxes.map((box) => box.x0)),
    y0: Math.min(...boxes.map((box) => box.y0)),
    x1: Math.max(...boxes.map((box) => box.x1)),
    y1: Math.max(...boxes.map((box) => box.y1)),
  };
}

function groupWordLines(words: OcrWord[]) {
  const lines: Array<{ y: number; words: OcrWord[] }> = [];
  words.forEach((word) => {
    const box = word.bbox;
    if (!box) return;
    const y = (box.y0 + box.y1) / 2;
    let line = lines.find((entry) => Math.abs(entry.y - y) < 7);
    if (!line) {
      line = { y, words: [] };
      lines.push(line);
    }
    line.words.push(word);
  });
  lines.forEach((line) =>
    line.words.sort((a, b) => (a.bbox?.x0 || 0) - (b.bbox?.x0 || 0)),
  );
  lines.sort((a, b) => a.y - b.y);
  return lines;
}

function lineText(line: { words: OcrWord[] }) {
  return line.words.map((word) => word.text).join(' ');
}

function moneyWord(line: { words: OcrWord[] }) {
  const found = line.words.filter((word) =>
    /^[\d,]+\.\d{2}$/.test(String(word.text).replace(/\s/g, '')),
  );
  return found.length ? found[found.length - 1] : null;
}

function wordText(word: OcrWord | undefined) {
  return String((word && word.text) || '').replace(/\s/g, '');
}

function isUnitWord(text: string) {
  return /^(?:\(\s*)?(?:kgs?|gms?|grams?)(?:\s*\))?$/i.test(text);
}

function findWeightSpan(words: OcrWord[]) {
  for (let index = 0; index < words.length; index += 1) {
    const text = wordText(words[index]);
    const combined =
      /^\d+(?:\.\d+)?(?:\(\s*)?(?:kgs?|gms?|grams?)(?:\s*\))?$/i.test(text) &&
      /[gk]/i.test(text);
    if (!isUnitWord(text) && !combined) continue;
    let start = index;
    let end = index;
    if (!combined && start > 0 && /^[(（]$/.test(wordText(words[start - 1])))
      start -= 1;
    if (
      !combined &&
      end + 1 < words.length &&
      /^[)）]$/.test(wordText(words[end + 1]))
    )
      end += 1;
    const numberIndex = start - 1;
    if (
      !combined &&
      numberIndex >= 0 &&
      /^\d+(?:\.\d+)?$/.test(wordText(words[numberIndex]))
    )
      start = numberIndex;
    const unitSource = combined ? text : wordText(words[index]);
    return { start, end, unit: normalizeUnit(unitSource), combined };
  }
  return null;
}

function weightBox(line: { words: OcrWord[] }): BBox | null {
  const span = findWeightSpan(line.words);
  if (!span) return null;
  const boxes = line.words
    .slice(span.start, span.end + 1)
    .map((word) => word.bbox)
    .filter((box): box is BBox => Boolean(box));
  if (!boxes.length) return null;
  return boxes.length === 1 ? boxes[0] : unionBox(boxes);
}

function findLabeledMoney(
  lines: Array<{ y: number; words: OcrWord[] }>,
  pattern: RegExp,
): MoneySpot | null {
  const line = lines.find((entry) => {
    const text = lineText(entry);
    if (/^\d{2}[./-]\d{2}[./-]\d{4}/.test(text)) return false;
    return pattern.test(text);
  });
  if (!line) return null;
  const money = moneyWord(line);
  if (!money?.bbox) return null;
  const mid = (money.bbox.y0 + money.bbox.y1) / 2;
  const labelWords = line.words.filter((word) => {
    if (word === money || !word.bbox) return false;
    const wordMid = (word.bbox.y0 + word.bbox.y1) / 2;
    const besideAmount =
      word.bbox.x1 <= money.bbox!.x0 + 6 &&
      word.bbox.x0 > money.bbox!.x0 - 460;
    return besideAmount && Math.abs(wordMid - mid) < 12;
  });
  const labelText = labelWords.map((word) => word.text).join(' ');
  return {
    bbox: money.bbox,
    label: labelWords.length
      ? unionBox(labelWords.map((word) => word.bbox!).filter(Boolean))
      : null,
    labelText,
    value: String(money.text).replace(/,/g, ''),
  };
}

function wordsBeforeWeight(line: { words: OcrWord[] }) {
  const words = line.words;
  const span = findWeightSpan(words);
  const cut = span ? span.start : words.length;
  const amount = moneyWord(line);
  return words.slice(0, cut).filter((word) => word !== amount);
}

function spotFromWords(words: OcrWord[]): Spot | null {
  if (!words.length) return null;
  const boxes = words
    .map((word) => word.bbox)
    .filter((box): box is BBox => Boolean(box));
  if (!boxes.length) return null;
  return {
    bbox: boxes.length === 1 ? boxes[0] : unionBox(boxes),
    text: words.map((word) => word.text).join(' '),
  };
}

function rowSpots(
  line: { words: OcrWord[] },
  data: Omit<AnjaniLineRow, 'id'>,
): RowLayout {
  const head = wordsBeforeWeight(line);
  if (!head.length) return {};
  let index = 1;
  let docWords: OcrWord[] = [];
  while (index < head.length && docWords.length === 0) {
    if (String(head[index].text).replace(/\D/g, '').length >= 6) {
      docWords = [head[index]];
    }
    index += 1;
    if (docWords.length) break;
  }
  if (!docWords.length && head[1]) {
    docWords = [head[1]];
    index = 2;
  }
  let typeWords: OcrWord[] = [];
  if (index < head.length && /^[A-Za-z]{1,6}$/.test(head[index].text)) {
    typeWords = [head[index]];
    index += 1;
  }
  const rest = head.slice(index);
  const centerWords = rest.length > 1 ? [rest[rest.length - 1]] : [];
  const partyWords = rest.length > 1 ? rest.slice(0, -1) : rest;
  function withEditorText(spot: Spot | null, value: string) {
    if (!spot) return null;
    return { bbox: spot.bbox, text: value || '' };
  }
  return {
    date: withEditorText(spotFromWords([head[0]]), data.date),
    docNo: withEditorText(spotFromWords(docWords), data.docNo),
    type: withEditorText(spotFromWords(typeWords), data.type),
    party: withEditorText(spotFromWords(partyWords), data.party),
    center: withEditorText(spotFromWords(centerWords), data.center),
  };
}

function rowFromLine(
  line: { words: OcrWord[] },
): Omit<AnjaniLineRow, 'id'> | null {
  const parsed = parseRows(lineText(line));
  if (parsed.length) return parsed[0];
  const amount = moneyWord(line);
  if (!amount) return null;
  const span = findWeightSpan(line.words);
  const weightWord = span ? line.words[span.start] : null;
  const weightText = weightWord ? wordText(weightWord) : '';
  const head = wordsBeforeWeight(line);
  let docNo = '';
  let type = 'ND';
  let party = '';
  let center = '';
  const docIndex = head.findIndex(
    (word, index) =>
      index > 0 && wordText(word).replace(/\D/g, '').length >= 6,
  );
  if (docIndex > 0) {
    docNo = wordText(head[docIndex]).replace(/\D/g, '');
    let index = docIndex + 1;
    if (
      index < head.length &&
      /^[A-Za-z]{1,6}$/.test(wordText(head[index]))
    ) {
      type = wordText(head[index]).toUpperCase();
      index += 1;
    }
    const place = splitPartyCenter(
      head
        .slice(index)
        .map((word) => word.text)
        .join(' '),
    );
    party = place.party.toUpperCase();
    center = place.center.toUpperCase();
  }
  return {
    date: cleanLine(line.words[0] ? line.words[0].text : '').replace(
      /[./]/g,
      '-',
    ),
    docNo,
    type,
    party,
    center,
    weight: formatWeight(weightText.replace(/[^\d.]/g, '')) || '0',
    unit: span ? span.unit : 'kg',
    amount: formatAmount(String(amount.text).replace(/[^\d.]/g, '')),
  };
}

export function buildLayout(words: OcrWord[]): PageLayout {
  const lines = groupWordLines(words);
  const rowLines = lines.filter((line) =>
    /^\d{2}[./-]\d{2}[./-]\d{4}/.test(
      line.words[0] ? line.words[0].text : '',
    ),
  );
  const rows: RowLayout[] = [];
  const dataRows: Array<Omit<AnjaniLineRow, 'id'>> = [];
  rowLines.forEach((line) => {
    const amount = moneyWord(line);
    const data = rowFromLine(line);
    if (!amount?.bbox || !data) return;
    rows.push({
      ...rowSpots(line, data),
      weight: weightBox(line),
      amount: amount.bbox,
    });
    dataRows.push(data);
  });
  const wordsLine = lines.find((line) => /\bOnly\b/i.test(lineText(line)));
  return {
    rows,
    dataRows,
    gross: findLabeledMoney(lines, /Gross\s*Amount/i),
    fuel: findLabeledMoney(lines, /Fuel\s*Surcharge/i),
    sub: findLabeledMoney(lines, /Sub\s*Total/i),
    sgst: findLabeledMoney(lines, /SGST|UTGST/i),
    cgst: findLabeledMoney(lines, /CGST|CCST/i),
    igst: findLabeledMoney(lines, /IGST/i),
    bill: findLabeledMoney(lines, /Bill\s*Amount/i),
    words: wordsLine
      ? unionBox(
          wordsLine.words
            .map((word) => word.bbox)
            .filter((box): box is BBox => Boolean(box)),
        )
      : null,
  };
}

export function emptyPageLayout(): PageLayout {
  return { rows: [], dataRows: [] };
}

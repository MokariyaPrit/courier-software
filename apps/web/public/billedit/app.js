// Change these values to restyle the figures written on the PDF.
// fontFamily: "Calibri", "Times New Roman", "Helvetica", or "Courier"
// fontWeight: 400, 500, 600, 700, ...
// size is in pixels (13, 14, 15, ...). Change one line, then download again.
const TEXT_STYLE = {
  fontFamily: "Calibri",
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
};

const SGST_RATE = 9;
const CGST_RATE = 9;
const IGST_RATE = 0;
const STORAGE_KEY = "shreeji-bill-v1";
const HEADER_FROM_STORAGE = new URLSearchParams(location.search).get("header") || "";
const DEFAULT_HEADER = HEADER_FROM_STORAGE || "";

const FIELD_IDS = [
  "customerName",
  "address1",
  "address2",
  "customerGst",
  "customerCode",
  "customerPan",
  "billNo",
  "billDate",
  "billPeriod",
  "hsn",
  "fuel",
  "bankName",
  "accountNo",
  "ifsc",
];



const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

let nextId = 1;
let state = { rows: [] };
let sourcePages = [];
let sourcePdfFile = null;
let companyProfile = {
  bankName: "",
  accountNo: "",
  ifsc: "",
  header: "",
  companyName: "Shree Anjani Courier",
};
let ocrStatusPrefix = "Reading the invoice… ";

function brandName() {
  return String(companyProfile.companyName || "Shree Anjani Courier").trim() || "Shree Anjani Courier";
}

function brandFilePrefix() {
  return brandName().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "Anjani";
}

function invoiceFileName(billNo) {
  const safe = String(billNo || "invoice").trim().replace(/[^\w.-]+/g, "-") || "invoice";
  return brandFilePrefix() + "-Anjani-Invoice-" + safe + ".pdf";
}

function applyEditorTitle() {
  const title = brandName() + " Bill Editor";
  const heading = document.getElementById("editorTitle");
  if (heading) heading.textContent = title;
  document.title = title;
}

function applyTextStyle() {
  const bill = document.getElementById("bill");
  const words = document.getElementById("words");
  if (!bill || !words) return;
  bill.style.fontFamily = TEXT_STYLE.fontFamily;
  bill.style.fontWeight = String(TEXT_STYLE.billAmount.fontWeight);
  bill.style.fontSize = TEXT_STYLE.billAmount.size + "px";
  words.style.fontFamily = TEXT_STYLE.fontFamily;
  words.style.fontWeight = String(TEXT_STYLE.words.fontWeight);
  words.style.fontSize = TEXT_STYLE.words.size + "px";
}

function askConfirm(title, message) {
  const root = document.getElementById("confirm");
  const yes = document.getElementById("confirmYes");
  const cancel = document.getElementById("confirmCancel");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = message;
  root.hidden = false;
  cancel.focus();
  return new Promise((resolve) => {
    function finish(ok) {
      root.hidden = true;
      yes.removeEventListener("click", onYes);
      cancel.removeEventListener("click", onCancel);
      root.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(ok);
    }
    function onYes() { finish(true); }
    function onCancel() { finish(false); }
    function onBackdrop(event) {
      if (event.target === root) finish(false);
    }
    function onKey(event) {
      if (event.key === "Escape") finish(false);
    }
    yes.addEventListener("click", onYes);
    cancel.addEventListener("click", onCancel);
    root.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

function showEditor(visible) {
  document.body.classList.toggle("has-bill", visible);
  document.getElementById("editor").hidden = !visible;
  document.getElementById("empty").hidden = visible;
  document.getElementById("download").disabled = !visible;
  updateBillbar();
}

function moneyToPaise(value) {
  const n = parseFloat(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function formatPaise(paise) {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return sign + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
}

function formatAmount(value) {
  return formatPaise(moneyToPaise(value));
}

function formatWeight(value) {
  const text = String(value ?? "").trim();
  if (text === "") return "";
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  return String(n);
}

function roundBillPaise(paise) {
  const sign = paise < 0 ? -1 : 1;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const frac = abs % 100;
  const rounded = frac >= 50 ? rupees + 1 : rupees;
  return sign * rounded * 100;
}

function percentOf(paise, percent) {
  return Math.round((paise * percent) / 100);
}

function calculate(amounts, fuelValue) {
  const gross = amounts.reduce((sum, amount) => sum + moneyToPaise(amount), 0);
  const fuel = moneyToPaise(fuelValue);
  const sub = gross + fuel;
  const sgst = percentOf(sub, SGST_RATE);
  const cgst = percentOf(sub, CGST_RATE);
  const igst = percentOf(sub, IGST_RATE);
  const exact = sub + sgst + cgst + igst;
  const bill = roundBillPaise(exact);
  return { gross, fuel, sub, sgst, cgst, igst, exact, bill };
}

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one ? " " + ONES[one] : "");
}

function threeDigits(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) return ONES[hundred] + " Hundred and " + twoDigits(rest);
  if (hundred) return ONES[hundred] + " Hundred";
  return twoDigits(rest);
}

function groupWords(n) {
  if (n < 100) return twoDigits(n);
  return threeDigits(n);
}

function inWords(rupees) {
  const n = Math.abs(Math.trunc(rupees));
  if (n === 0) return "Zero Only";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(groupWords(crore) + " Crore");
  if (lakh) parts.push(groupWords(lakh) + " Lakh");
  if (thousand) parts.push(groupWords(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ") + " Only";
}

function billWords(paise) {
  const rupees = Math.trunc(paise / 100);
  const words = inWords(rupees);
  return rupees < 0 ? "Minus " + words : words;
}

function explain(totals) {
  const base = "Gross amount " + formatPaise(totals.gross)
    + " plus fuel surcharge " + formatPaise(totals.fuel)
    + " gives sub total " + formatPaise(totals.sub)
    + ". SGST 9% is " + formatPaise(totals.sgst)
    + ", CGST 9% is " + formatPaise(totals.cgst)
    + ", IGST 0% is " + formatPaise(totals.igst)
    + ". Bill amount is " + formatPaise(totals.bill) + ".";
  if (totals.exact === totals.bill) return base;
  return base + " The exact total " + formatPaise(totals.exact) + " is rounded to the nearest rupee.";
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function blankRow() {
  return { id: nextId++, date: "", docNo: "", type: "ND", party: "", center: "", weight: "", unit: "kg", amount: "" };
}

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rows)) return null;
    return data;
  } catch {
    return null;
  }
}

function fillHeader(data) {
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = data[id] ?? "";
  });
}

function renderRows() {
  const tbody = document.getElementById("rows");
  const onlyOne = state.rows.length === 1;
  tbody.innerHTML = state.rows.map((row) => `
    <tr>
      <td data-label="Date"><input data-row="${row.id}" data-field="date" value="${esc(row.date)}" autocomplete="off" spellcheck="false"></td>
      <td data-label="DOC No."><input data-row="${row.id}" data-field="docNo" value="${esc(row.docNo)}" autocomplete="off" spellcheck="false"></td>
      <td data-label="Type"><input data-row="${row.id}" data-field="type" value="${esc(row.type)}" autocomplete="off" spellcheck="false"></td>
      <td data-label="Party Name"><input data-row="${row.id}" data-field="party" value="${esc(row.party)}" autocomplete="off" spellcheck="false"></td>
      <td data-label="Center"><input data-row="${row.id}" data-field="center" value="${esc(row.center)}" autocomplete="off" spellcheck="false"></td>
      <td class="main-edit num" data-label="Weight">
        <div class="weight-wrap">
          <input class="weight" data-row="${row.id}" data-field="weight" value="${esc(row.weight)}" inputmode="decimal" autocomplete="off" spellcheck="false">
          <span>${esc(unitLabel(row.unit))}</span>
        </div>
      </td>
      <td class="main-edit num" data-label="Amount">
        <input class="amount" data-row="${row.id}" data-field="amount" value="${esc(row.amount)}" inputmode="decimal" autocomplete="off" spellcheck="false">
      </td>
      <td class="no-print row-actions">
        <button type="button" data-remove="${row.id}" aria-label="Remove row" ${onlyOne ? "disabled" : ""}>&times;</button>
      </td>
    </tr>
  `).join("");
}

const TOTAL_IDS = ["gross", "fuel", "sub", "sgst", "cgst", "igst", "bill"];

function setField(id, value) {
  const field = document.getElementById(id);
  if (field) field.value = value;
}

function fieldValue(id) {
  const field = document.getElementById(id);
  return field ? field.value : "";
}

function recalc() {
  const totals = calculate(state.rows.map((row) => row.amount), fieldValue("fuel"));
  setField("gross", formatPaise(totals.gross));
  setField("sub", formatPaise(totals.sub));
  setField("sgst", formatPaise(totals.sgst));
  setField("cgst", formatPaise(totals.cgst));
  setField("igst", formatPaise(totals.igst));
  setField("bill", formatPaise(totals.bill));
  setField("words", billWords(totals.bill));
  document.getElementById("calcNote").textContent = explain(totals);
  updateBillbar();
}

function updateBillbar() {
  const bar = document.getElementById("billbar");
  if (!bar) return;
  const visible = document.body.classList.contains("has-bill");
  bar.hidden = !visible;
  if (!visible) return;
  const rows = state.rows.length;
  const pages = sourcePages.length;
  const rowLabel = rows + (rows === 1 ? " row" : " rows");
  const pageLabel = pages ? " · " + pages + (pages === 1 ? " page" : " pages") : "";
  document.getElementById("billMeta").textContent = rowLabel + pageLabel;
  document.getElementById("billLive").textContent = "Bill amount " + (fieldValue("bill") || "0.00");
}

function showBusy(title, detail, progress) {
  const root = document.getElementById("busy");
  root.hidden = false;
  document.getElementById("busyTitle").textContent = title;
  document.getElementById("busyDetail").textContent = detail || "";
  const bar = document.getElementById("busyBar");
  if (progress == null) {
    bar.classList.add("indeterminate");
    bar.style.width = "";
  } else {
    bar.classList.remove("indeterminate");
    bar.style.width = Math.max(0, Math.min(1, progress)) * 100 + "%";
  }
}

function hideBusy() {
  const root = document.getElementById("busy");
  if (root) root.hidden = true;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let saveTimer = 0;

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

function save() {
  const data = { rows: state.rows.map(({ id, ...row }) => row) };
  FIELD_IDS.forEach((id) => {
    data[id] = document.getElementById(id).value;
  });
  const letterhead = document.getElementById("letterhead");
  if (letterhead && letterhead.src.startsWith("data:")) data.headerImage = letterhead.src;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    delete data.headerImage;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (again) { /* keep the bill on screen */ }
  }
}

function applyState(data) {
  state.rows = (data.rows || []).map((row) => ({
    id: nextId++,
    date: row.date || "",
    docNo: row.docNo || "",
    type: row.type || "ND",
    party: row.party || "",
    center: row.center || "",
    weight: row.weight ?? "",
    unit: normalizeUnit(row.unit),
    amount: row.amount ?? "",
  }));
  if (state.rows.length === 0) state.rows.push(blankRow());
  fillHeader(data);
  renderRows();
  recalc();
}

function syncRowFromInput(input) {
  const row = state.rows.find((item) => String(item.id) === input.dataset.row);
  if (!row) return;
  row[input.dataset.field] = input.value;
}

function canvasToJpegUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare a page image"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not read a page image"));
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.86);
  });
}

function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

async function addCanvasPages(pdf, canvas) {
  const pageW = 210;
  const pageH = 297;
  const pxPerMm = canvas.width / pageW;
  const heightMm = canvas.height / pxPerMm;
  if (heightMm <= pageH + 4) {
    const scale = Math.min(1, pageH / heightMm);
    const url = await canvasToJpegUrl(canvas);
    pdf.addImage(url, "JPEG", (pageW - pageW * scale) / 2, 0, pageW * scale, heightMm * scale, undefined, "FAST");
    return;
  }
  const pagePx = Math.floor(pageH * pxPerMm);
  let y = 0;
  let first = true;
  while (y < canvas.height) {
    const sliceH = Math.min(pagePx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    first = false;
    const url = await canvasToJpegUrl(slice);
    pdf.addImage(url, "JPEG", 0, 0, pageW, sliceH / pxPerMm, undefined, "FAST");
    releaseCanvas(slice);
    y += sliceH;
    await pause(20);
  }
}

async function buildEditedPdf(onProgress) {
  if (typeof html2canvas !== "function" || !window.jspdf) {
    throw new Error("PDF library failed to load");
  }
  const sheet = document.getElementById("sheet");
  const fileName = invoiceFileName(document.getElementById("billNo").value);
  const pageRowCount = sourcePages.reduce((sum, page) => sum + page.layout.rows.length, 0);
  if (sourcePages.length && pageRowCount === state.rows.length) {
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: false });
    let offset = 0;
    for (let index = 0; index < sourcePages.length; index += 1) {
      const page = sourcePages[index];
      const count = page.layout.rows.length;
      const slice = state.rows.slice(offset, offset + count);
      offset += count;
      const label = "Page " + (index + 1) + " of " + sourcePages.length;
      onProgress?.(label, index / sourcePages.length);
      await pause(40);
      const canvas = stampOriginal(page, slice);
      if (index > 0) pdf.addPage();
      await addCanvasPages(pdf, canvas);
      releaseCanvas(canvas);
    }
    onProgress?.("Saving the file…", 1);
    await pause(40);
    return { blob: pdf.output("blob"), fileName };
  }
  onProgress?.("Drawing the invoice…", null);
  await pause(40);
  const canvas = await html2canvas(sheet, {
    scale: state.rows.length > 80 ? 1.15 : 2,
    backgroundColor: "#ffffff",
    onclone(doc) {
      const clone = doc.getElementById("sheet");
      clone.classList.add("pdf-mode");
      clone.querySelectorAll(".no-print").forEach((el) => el.remove());
      clone.querySelectorAll("input").forEach((input) => {
        const span = doc.createElement("span");
        const numeric = input.classList.contains("amount") || input.classList.contains("fuel");
        span.className = numeric ? "frozen num" : "frozen";
        span.textContent = numeric ? formatAmount(input.value) : input.value;
        input.replaceWith(span);
      });
    },
  });
  const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", compress: false });
  onProgress?.("Saving the file…", 0.9);
  await addCanvasPages(pdf, canvas);
  releaseCanvas(canvas);
  return { blob: pdf.output("blob"), fileName };
}

function triggerPdfDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPdf() {
  const button = document.getElementById("download");
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing PDF...";
  showBusy("Creating the PDF", "Starting…", 0);
  try {
    const built = await buildEditedPdf((detail, progress) => {
      button.textContent = detail;
      showBusy("Creating the PDF", detail, progress);
    });
    triggerPdfDownload(built.blob, built.fileName);
  } catch (error) {
    console.error(error);
    window.alert("Could not create the PDF. Keep this page open and try Download PDF again.");
  } finally {
    hideBusy();
    button.disabled = false;
    button.textContent = previous;
  }
}

function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function grab(text, regex) {
  const match = text.match(regex);
  return match ? cleanLine(match[1]) : "";
}

function normalizeUnit(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (text.startsWith("g")) return "gm";
  return "kg";
}

function unitLabel(unit) {
  return "(" + normalizeUnit(unit) + ")";
}

function cleanName(value) {
  return cleanLine(value).replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

function splitPartyCenter(rest) {
  const parts = cleanLine(rest).split(" ").filter(Boolean);
  if (parts.length <= 1) return { party: cleanName(parts[0] || ""), center: "" };
  return {
    party: cleanName(parts.slice(0, -1).join(" ")),
    center: cleanName(parts[parts.length - 1]),
  };
}

function parseRows(text) {
  const raw = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const lines = [];
  for (let i = 0; i < raw.length; i += 1) {
    let line = raw[i];
    const hasDate = /\d{2}[./-]\d{2}[./-]\d{4}/.test(line);
    const hasAmount = /\d[\d,]*\.\d{2}\s*$/.test(line);
    if (hasDate && !hasAmount && raw[i + 1]) {
      line = line + " " + raw[i + 1];
      i += 1;
    }
    lines.push(line);
  }
  const rowPattern = /(\d{2}[./-]\d{2}[./-]\d{4})\s+(\d{6,16})\s+([A-Za-z]{1,6})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*\(?\s*(kgs?|gms?|grams?)\s*\)?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const rows = [];
  lines.forEach((line) => {
    const match = line.replace(/[（]/g, "(").replace(/[）]/g, ")").match(rowPattern);
    if (!match) return;
    const place = splitPartyCenter(match[4]);
    rows.push({
      date: match[1].replace(/[./]/g, "-"),
      docNo: match[2],
      type: match[3].toUpperCase(),
      party: place.party.toUpperCase(),
      center: place.center.toUpperCase(),
      weight: formatWeight(match[5]),
      unit: normalizeUnit(match[6]),
      amount: formatAmount(match[7]),
    });
  });
  return rows;
}

function invoiceBody(text) {
  const source = String(text || "").replace(/\r/g, "");
  const start = source.search(/Customer\s*Name/i);
  return start >= 0 ? source.slice(start) : source;
}

function readCustomerCode(text) {
  const match = text.match(/Customer\s*Code\s*[:\-]?\s*([A-Za-z0-9-]+)/i);
  if (!match) return "";
  const raw = text.slice(match.index, match.index + match[0].length);
  let code = match[1];
  if (!/[:\-]/.test(raw) && /^1\d{1,4}$/.test(code)) code = code.slice(1);
  return code;
}

function readCustomerPan(text) {
  const match = text.match(/PAN\s*No\.?\s*[:\-]?\s*(\S+)/i);
  if (!match) return "-";
  const value = match[1].replace(/[^A-Za-z0-9-]/g, "");
  if (/^[A-Z]{5}\d{4}[A-Z]$/i.test(value)) return value.toUpperCase();
  return "-";
}

function parseInvoice(text) {
  const source = invoiceBody(text);
  const rows = parseRows(source);
  return {
    customerName: grab(source, /Customer\s*Name\s*[:\-]?\s*(.+?)(?=\s+Bill\s*No\b|\n|$)/i),
    address1: grab(source, /Address\s*[:\-]?\s*(.+?)(?=\s+Date\s*[:\-]|\n|$)/i),
    address2: grab(source, /Address\s*[:\-]?\s*.+\n\s*([A-Z][A-Z0-9 ,.-]*?\d{3,}[A-Z0-9 ,.-]*?)(?=\s+Bill\s*No\b|\n|$)/i),
    customerGst: grab(source, /GST\s*No\.?\s*[:\-]?\s*([0-9A-Z]{15})/i),
    customerCode: readCustomerCode(source),
    customerPan: readCustomerPan(source),
    billNo: grab(source, /Bill\s*No\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9/-]*)/i),
    billDate: grab(source, /Bill\s*No\b[\s\S]{0,80}?Date\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i),
    billPeriod: grab(source, /Bill\s*Period\s*[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4}\s*(?:To|TO|to)\s*\d{2}[./-]\d{2}[./-]\d{4})/i),
    hsn: grab(source, /HSN\s*\/?\s*SAC\s*Code\s*[:\-]?\s*(\d{4,8}\s*\/\s*[A-Za-z][A-Za-z ]*)/i),
    fuel: (() => {
      const value = grab(source, /Fuel\s*Surcharge\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)/i);
      return value ? formatAmount(value) : "";
    })(),
    bankName: grab(source, /Bank\s*Name\s*[:\-]?\s*(.+?)(?=\s+Acc(?:ount)?\b|\s+IFSC\b|\s+SGST\b|\s+Gross\b|\n|$)/i),
    accountNo: grab(source, /Acc(?:ount)?\.?\s*No\.?\s*[:\-]?\s*(\d{6,20})/i),
    ifsc: grab(source, /IFSC\s*Code\s*[:\-]?\s*([A-Z0-9]{8,15})/i),
    rows,
  };
}

async function readBankFromCanvas(canvas, words) {
  const bank = (words || []).find((word) => /^bank$/i.test(word.text) && word.bbox && word.bbox.x0 < canvas.width * 0.4);
  if (!bank) return null;
  const note = (words || []).find((word) => /^note$/i.test(word.text) && word.bbox && word.bbox.y0 > bank.bbox.y1 && word.bbox.x0 < canvas.width * 0.45);
  const y = Math.max(0, Math.floor(bank.bbox.y0 - 8));
  const y1 = note ? Math.min(canvas.height, Math.floor(note.bbox.y0 - 4)) : Math.min(canvas.height, y + 340);
  const width = Math.min(canvas.width, Math.floor(canvas.width * 0.64));
  const height = Math.max(48, y1 - y);
  const zoom = 2;
  const crop = document.createElement("canvas");
  crop.width = width * zoom;
  crop.height = height * zoom;
  const ctx = crop.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.drawImage(canvas, 0, y, width, height, 0, 0, crop.width, crop.height);
  const read = await ocrCanvas(crop);
  return parseInvoice(read.text || "");
}

function setUploadStatus(message, isError) {
  const status = document.getElementById("uploadStatus");
  status.textContent = message || "";
  status.classList.toggle("error", Boolean(isError));
  const busy = document.getElementById("busy");
  if (!busy || busy.hidden || isError || !message) return;
  const page = message.match(/page\s+(\d+)\s+of\s+(\d+)/i);
  const pct = message.match(/(\d+)\s*%/);
  if (!page) {
    document.getElementById("busyDetail").textContent = message;
    return;
  }
  const current = Number(page[1]);
  const total = Number(page[2]) || 1;
  const inner = pct ? Number(pct[1]) / 100 : 0;
  showBusy("Reading the invoice", message, ((current - 1) + inner) / total);
}

function findHeaderRule(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

function cropHeader(canvas) {
  const rule = findHeaderRule(canvas);
  if (!rule) return "";
  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  slice.height = Math.min(canvas.height, rule + 3);
  slice.getContext("2d").drawImage(canvas, 0, 0, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
  return slice.toDataURL("image/jpeg", 0.9);
}

async function renderPdfPage(page) {
  const viewport = page.getViewport({ scale: 2.4 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d", { willReadFrequently: true }), viewport }).promise;
  return canvas;
}

async function textFromPdfPage(page) {
  const content = await page.getTextContent();
  const items = content.items.filter((item) => item.str && item.str.trim());
  if (!items.length) return "";
  const rows = [];
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    let row = rows.find((entry) => Math.abs(entry.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform[4], str: item.str });
  });
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => row.parts.sort((a, b) => a.x - b.x).map((part) => part.str).join(" ")).join("\n");
}

let ocrWorker = null;

async function ocrCanvas(canvas) {
  if (!window.Tesseract) throw new Error("The reader failed to load. Refresh the page and try the PDF again.");
  if (!ocrWorker) {
    setUploadStatus("Preparing to read the invoice…");
    ocrWorker = await Tesseract.createWorker("eng", 1, {
        logger(message) {
          if (message.status === "recognizing text") {
            setUploadStatus(ocrStatusPrefix + Math.round((message.progress || 0) * 100) + "%");
          }
        },
    });
  }
  const result = await ocrWorker.recognize(canvas);
  return {
    text: result.data.text || "",
    words: result.data.words || [],
  };
}

function unionBox(boxes) {
  return {
    x0: Math.min(...boxes.map((box) => box.x0)),
    y0: Math.min(...boxes.map((box) => box.y0)),
    x1: Math.max(...boxes.map((box) => box.x1)),
    y1: Math.max(...boxes.map((box) => box.y1)),
  };
}

function groupWordLines(words) {
  const lines = [];
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
  lines.forEach((line) => line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
  lines.sort((a, b) => a.y - b.y);
  return lines;
}

function lineText(line) {
  return line.words.map((word) => word.text).join(" ");
}

function moneyWord(line) {
  const found = line.words.filter((word) => /^[\d,]+\.\d{2}$/.test(String(word.text).replace(/\s/g, "")));
  return found.length ? found[found.length - 1] : null;
}

function wordText(word) {
  return String(word && word.text || "").replace(/\s/g, "");
}

function isUnitWord(text) {
  return /^(?:\(\s*)?(?:kgs?|gms?|grams?)(?:\s*\))?$/i.test(text);
}

function findWeightSpan(words) {
  for (let index = 0; index < words.length; index += 1) {
    const text = wordText(words[index]);
    const combined = /^\d+(?:\.\d+)?(?:\(\s*)?(?:kgs?|gms?|grams?)(?:\s*\))?$/i.test(text) && /[gk]/i.test(text);
    if (!isUnitWord(text) && !combined) continue;
    let start = index;
    let end = index;
    if (!combined && start > 0 && /^[(（]$/.test(wordText(words[start - 1]))) start -= 1;
    if (!combined && end + 1 < words.length && /^[)）]$/.test(wordText(words[end + 1]))) end += 1;
    const numberIndex = start - 1;
    if (!combined && numberIndex >= 0 && /^\d+(?:\.\d+)?$/.test(wordText(words[numberIndex]))) start = numberIndex;
    const unitSource = combined ? text : wordText(words[index]);
    return { start, end, unit: normalizeUnit(unitSource), combined };
  }
  return null;
}

function weightBox(line) {
  const span = findWeightSpan(line.words);
  if (!span) return null;
  const boxes = line.words.slice(span.start, span.end + 1).map((word) => word.bbox).filter(Boolean);
  if (!boxes.length) return null;
  return boxes.length === 1 ? boxes[0] : unionBox(boxes);
}

function sameText(left, right) {
  return String(left || "").replace(/\s+/g, " ").trim().toLowerCase() === String(right || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findLabeledMoney(lines, pattern) {
  const line = lines.find((entry) => {
    const text = lineText(entry);
    if (/^\d{2}[./-]\d{2}[./-]\d{4}/.test(text)) return false;
    return pattern.test(text);
  });
  if (!line) return null;
  const money = moneyWord(line);
  if (!money) return null;
  const mid = (money.bbox.y0 + money.bbox.y1) / 2;
  const labelWords = line.words.filter((word) => {
    if (word === money) return false;
    const wordMid = (word.bbox.y0 + word.bbox.y1) / 2;
    const besideAmount = word.bbox.x1 <= money.bbox.x0 + 6 && word.bbox.x0 > money.bbox.x0 - 460;
    return besideAmount && Math.abs(wordMid - mid) < 12;
  });
  const labelText = labelWords.map((word) => word.text).join(" ");
  return {
    bbox: money.bbox,
    label: labelWords.length ? unionBox(labelWords.map((word) => word.bbox)) : null,
    labelText,
    value: String(money.text).replace(/,/g, ""),
  };
}

function wordsBeforeWeight(line) {
  const words = line.words;
  const span = findWeightSpan(words);
  const cut = span ? span.start : words.length;
  const amount = moneyWord(line);
  return words.slice(0, cut).filter((word) => word !== amount);
}

function spotFromWords(words) {
  if (!words.length) return null;
  return {
    bbox: words.length === 1 ? words[0].bbox : unionBox(words.map((word) => word.bbox)),
    text: words.map((word) => word.text).join(" "),
  };
}

function rowSpots(line, data) {
  const head = wordsBeforeWeight(line);
  if (!head.length) return {};
  let index = 1;
  let docWords = [];
  while (index < head.length && docWords.length === 0) {
    if (String(head[index].text).replace(/\D/g, "").length >= 6) docWords = [head[index]];
    index += 1;
    if (docWords.length) break;
  }
  if (!docWords.length && head[1]) {
    docWords = [head[1]];
    index = 2;
  }
  let typeWords = [];
  if (index < head.length && /^[A-Za-z]{1,6}$/.test(head[index].text)) {
    typeWords = [head[index]];
    index += 1;
  }
  const rest = head.slice(index);
  const centerWords = rest.length > 1 ? [rest[rest.length - 1]] : [];
  const partyWords = rest.length > 1 ? rest.slice(0, -1) : rest;
  function withEditorText(spot, value) {
    if (!spot) return null;
    return { bbox: spot.bbox, text: value || "" };
  }
  return {
    date: withEditorText(spotFromWords([head[0]]), data.date),
    docNo: withEditorText(spotFromWords(docWords), data.docNo),
    type: withEditorText(spotFromWords(typeWords), data.type),
    party: withEditorText(spotFromWords(partyWords), data.party),
    center: withEditorText(spotFromWords(centerWords), data.center),
  };
}

function rowFromLine(line) {
  const parsed = parseRows(lineText(line));
  if (parsed.length) return parsed[0];
  const amount = moneyWord(line);
  if (!amount) return null;
  const span = findWeightSpan(line.words);
  const weightWord = span ? line.words[span.start] : null;
  const weightText = weightWord ? wordText(weightWord) : "";
  const head = wordsBeforeWeight(line);
  let docNo = "";
  let type = "ND";
  let party = "";
  let center = "";
  const docIndex = head.findIndex((word, index) => index > 0 && wordText(word).replace(/\D/g, "").length >= 6);
  if (docIndex > 0) {
    docNo = wordText(head[docIndex]).replace(/\D/g, "");
    let index = docIndex + 1;
    if (index < head.length && /^[A-Za-z]{1,6}$/.test(wordText(head[index]))) {
      type = wordText(head[index]).toUpperCase();
      index += 1;
    }
    const place = splitPartyCenter(head.slice(index).map((word) => word.text).join(" "));
    party = place.party.toUpperCase();
    center = place.center.toUpperCase();
  }
  return {
    date: cleanLine(line.words[0] ? line.words[0].text : "").replace(/[./]/g, "-"),
    docNo,
    type,
    party,
    center,
    weight: formatWeight(weightText.replace(/[^\d.]/g, "")) || "0",
    unit: span ? span.unit : "kg",
    amount: formatAmount(String(amount.text).replace(/[^\d.]/g, "")),
  };
}

function buildLayout(words) {
  const lines = groupWordLines(words);
  const rowLines = lines.filter((line) => /^\d{2}[./-]\d{2}[./-]\d{4}/.test(line.words[0] ? line.words[0].text : ""));
  const rows = [];
  const dataRows = [];
  rowLines.forEach((line) => {
    const amount = moneyWord(line);
    const data = rowFromLine(line);
    if (!amount || !data) return;
    rows.push(Object.assign({ weight: weightBox(line), amount: amount.bbox }, rowSpots(line, data)));
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
    words: wordsLine ? unionBox(wordsLine.words.map((word) => word.bbox)) : null,
  };
}

function pagePixelSize(px, canvas) {
  return px * (canvas.width / 794);
}

function paintBox(ctx, box, text, fontPx, fontWeight, alignRight) {
  const padY = 2;
  const padX = 4;
  ctx.save();
  ctx.font = fontWeight + " " + fontPx + "px " + TEXT_STYLE.fontFamily;
  const measured = ctx.measureText(text).width;
  const right = box.x1;
  const left = alignRight ? Math.min(box.x0, right - measured) - padX : box.x0 - padX;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(left, box.y0 - padY, right - left + padX, box.y1 - box.y0 + padY * 2);
  ctx.fillStyle = "#000000";
  ctx.textAlign = alignRight ? "right" : "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, alignRight ? right - 1 : box.x0, (box.y0 + box.y1) / 2);
  ctx.restore();
}

function paintLeft(ctx, box, text, fontPx, fontWeight, limitRight) {
  const padY = 2;
  const padX = 3;
  ctx.save();
  ctx.font = fontWeight + " " + fontPx + "px " + TEXT_STYLE.fontFamily;
  const measured = ctx.measureText(String(text || "")).width;
  const left = box.x0 - padX;
  const right = Math.min(Math.max(box.x1, box.x0 + measured) + padX, limitRight - 2);
  const width = Math.max(4, right - left);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(left, box.y0 - padY, width, box.y1 - box.y0 + padY * 2);
  ctx.beginPath();
  ctx.rect(left, box.y0 - padY, width, box.y1 - box.y0 + padY * 2);
  ctx.clip();
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || ""), box.x0, (box.y0 + box.y1) / 2);
  ctx.restore();
}

function stampOriginal(page, rows) {
  const copy = document.createElement("canvas");
  copy.width = page.canvas.width;
  copy.height = page.canvas.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(page.canvas, 0, 0);
  const px = (key) => pagePixelSize(TEXT_STYLE[key].size, copy);
  const weightOf = (key) => TEXT_STYLE[key].fontWeight;
  const layout = page.layout;
  const pageRows = rows || state.rows;
  const withTotals = Boolean(layout.gross || layout.bill);
  pageRows.forEach((row, index) => {
    const spot = layout.rows[index];
    if (!spot) return;
    const textFields = ["date", "docNo", "type", "party", "center"];
    textFields.forEach((key, fieldIndex) => {
      const field = spot[key];
      if (!field || !field.bbox || sameText(row[key], field.text)) return;
      const next = textFields.slice(fieldIndex + 1).map((name) => spot[name] && spot[name].bbox).find(Boolean);
      const limit = next ? next.x0 : (spot.weight ? spot.weight.x0 : field.bbox.x1 + 160);
      paintLeft(ctx, field.bbox, row[key], px("rowText"), weightOf("rowText"), limit);
    });
    if (spot.weight) paintBox(ctx, spot.weight, formatWeight(row.weight) + " " + unitLabel(row.unit), px("weight"), weightOf("weight"), true);
    if (spot.amount) paintBox(ctx, spot.amount, formatAmount(row.amount), px("amount"), weightOf("amount"), true);
  });
  if (!withTotals) return copy;
  const figures = [
    [layout.gross, fieldValue("gross"), fieldValue("grossLabel"), "grossAmount"],
    [layout.fuel, fieldValue("fuel"), fieldValue("fuelLabel"), "fuelSurcharge"],
    [layout.sub, fieldValue("sub"), fieldValue("subLabel"), "subTotal"],
    [layout.sgst, fieldValue("sgst"), fieldValue("sgstLabel"), "sgst"],
    [layout.cgst, fieldValue("cgst"), fieldValue("cgstLabel"), "cgst"],
    [layout.igst, fieldValue("igst"), fieldValue("igstLabel"), "igst"],
    [layout.bill, fieldValue("bill"), fieldValue("billLabel"), "billAmount"],
  ];
  figures.forEach(([spot, value, label, key]) => {
    if (!spot) return;
    if (spot.label && label && !sameText(label, spot.labelText)) paintBox(ctx, spot.label, label, px(key), weightOf(key), true);
    if (spot.bbox) paintBox(ctx, spot.bbox, formatAmount(value), px(key), weightOf(key), true);
  });
  if (layout.words) paintBox(ctx, layout.words, fieldValue("words"), px("words"), weightOf("words"), true);
  return copy;
}

function filled(value) {
  return String(value || "").trim();
}

function firstFilled(items, key) {
  const found = items.find((item) => filled(item[key]));
  return found ? found[key] : "";
}

function lastFilled(items, key) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (filled(items[index][key])) return items[index][key];
  }
  return "";
}

function setHeaderSrc(url) {
  const letterhead = document.getElementById("letterhead");
  if (!letterhead || !url) return;
  if (/^https?:/i.test(url)) letterhead.crossOrigin = "anonymous";
  else letterhead.removeAttribute("crossorigin");
  letterhead.src = url;
}

function fillBankFromCompany() {
  const fields = [
    ["bankName", companyProfile.bankName],
    ["accountNo", companyProfile.accountNo],
    ["ifsc", companyProfile.ifsc],
  ];
  fields.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && !String(el.value || "").trim() && value) el.value = value;
  });
}

function collectBill() {
  const data = { rows: state.rows.map(({ id, ...row }) => row) };
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    data[id] = el ? el.value : "";
  });
  ["gross", "sub", "sgst", "cgst", "igst", "bill", "words"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  return data;
}

async function importPdf(file) {
  sourcePdfFile = file;
  if (!window.pdfjsLib) {
    setUploadStatus("The PDF reader failed to load. Refresh the page and try again.", true);
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
  showBusy("Reading the invoice", "Opening " + file.name + "…", 0.02);
  setUploadStatus("Opening " + file.name + "…");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const bundles = [];
  let headerImage = "";
  for (let number = 1; number <= pageCount; number += 1) {
    const page = await pdf.getPage(number);
    const canvas = await renderPdfPage(page);
    if (number === 1) headerImage = cropHeader(canvas);
    let text = await textFromPdfPage(page);
    let words = [];
    let layout = null;
    if (text.replace(/\s/g, "").length < 40) {
      ocrStatusPrefix = "Reading page " + number + " of " + pageCount + "… ";
      setUploadStatus(ocrStatusPrefix.trim());
      const read = await ocrCanvas(canvas);
      text = read.text;
      words = read.words || [];
      layout = buildLayout(words);
    }
    const parsed = parseInvoice(text);
    const hasBankLabel = words.some((word) => /^bank$/i.test(word.text) && word.bbox && word.bbox.x0 < canvas.width * 0.4);
    if (hasBankLabel && (!parsed.bankName || !parsed.accountNo)) {
      ocrStatusPrefix = "Reading bank details… ";
      setUploadStatus("Reading bank details…");
      const bankRead = await readBankFromCanvas(canvas, words);
      if (bankRead) {
        if (!parsed.bankName && bankRead.bankName) parsed.bankName = bankRead.bankName;
        if (!parsed.accountNo && bankRead.accountNo) parsed.accountNo = bankRead.accountNo;
        if (!parsed.ifsc && bankRead.ifsc) parsed.ifsc = bankRead.ifsc;
      }
    }
    bundles.push({
      canvas,
      layout: layout || { rows: [], dataRows: [] },
      parsed,
    });
  }
  const rows = bundles.flatMap((bundle) => bundle.layout.dataRows || []);
  if (!rows.length) {
    sourcePages = [];
    setUploadStatus("This PDF does not match the invoice layout. Use a tax invoice with Date, DOC No., Weight and Amount.", true);
    return;
  }
  const headers = bundles.map((bundle) => bundle.parsed);
  const currentBank = {
    bankName: document.getElementById("bankName").value,
    accountNo: document.getElementById("accountNo").value,
    ifsc: document.getElementById("ifsc").value,
  };
  const fuelFromBox = bundles.reduce((found, bundle) => {
    const spot = bundle.layout.fuel;
    return spot && spot.value ? formatAmount(spot.value) : found;
  }, "");
  applyState({
    customerName: firstFilled(headers, "customerName"),
    address1: firstFilled(headers, "address1"),
    address2: firstFilled(headers, "address2"),
    customerGst: firstFilled(headers, "customerGst"),
    customerCode: firstFilled(headers, "customerCode"),
    customerPan: firstFilled(headers, "customerPan") || "-",
    billNo: firstFilled(headers, "billNo"),
    billDate: firstFilled(headers, "billDate"),
    billPeriod: firstFilled(headers, "billPeriod"),
    hsn: firstFilled(headers, "hsn"),
    fuel: fuelFromBox || lastFilled(headers, "fuel") || "0.00",
    bankName: lastFilled(headers, "bankName") || currentBank.bankName,
    accountNo: lastFilled(headers, "accountNo") || currentBank.accountNo,
    ifsc: lastFilled(headers, "ifsc") || currentBank.ifsc,
    rows,
  });
  fillBankFromCompany();
  if (headerImage) setHeaderSrc(headerImage);
  else if (companyProfile.header) setHeaderSrc(companyProfile.header);
  const placed = bundles.reduce((sum, bundle) => sum + bundle.layout.rows.length, 0);
  sourcePages = placed === rows.length
    ? bundles.map((bundle) => ({ canvas: bundle.canvas, layout: bundle.layout }))
    : [];
  document.body.dataset.layout = sourcePages.length ? "original" : "rebuilt";
  showEditor(true);
  applyTextStyle();
  save();
  const noun = rows.length === 1 ? "row" : "rows";
  const pages = pageCount === 1 ? "1 page" : pageCount + " pages";
  let message = "Loaded " + rows.length + " " + noun + " from " + pages + " in " + file.name + ". Check the weight and amount, then download the PDF.";
  if (!firstFilled(headers, "customerGst")) message += " The customer GST number was not readable, so type it in if you need it.";
  setUploadStatus(message);
}

function applyStoredHeader() {
  if (DEFAULT_HEADER) setHeaderSrc(DEFAULT_HEADER);
}

function applyIncomingBill(message) {
  companyProfile = {
    bankName: message.bank && message.bank.bankName || "",
    accountNo: message.bank && message.bank.accountNo || "",
    ifsc: message.bank && message.bank.ifsc || "",
    header: message.header || companyProfile.header || "",
    companyName:
      (message.companyName && String(message.companyName).trim()) ||
      companyProfile.companyName ||
      "Shree Anjani Courier",
  };
  applyEditorTitle();
  if (companyProfile.header) setHeaderSrc(companyProfile.header);
  const bill = message.bill;
  const hasBill = bill && (Array.isArray(bill.rows) && bill.rows.length || bill.customerName || bill.billNo);
  if (hasBill) {
    applyState({
      ...bill,
      bankName: bill.bankName || companyProfile.bankName,
      accountNo: bill.accountNo || companyProfile.accountNo,
      ifsc: bill.ifsc || companyProfile.ifsc,
    });
    if (message.header) setHeaderSrc(message.header);
    showEditor(true);
    const download = document.getElementById("download");
    if (download) download.disabled = false;
    return;
  }
  fillBankFromCompany();
}

async function replyWithBill(requestId, source) {
  const bill = collectBill();
  let pdfBuffer = null;
  if (sourcePdfFile) pdfBuffer = await sourcePdfFile.arrayBuffer();
  const letterhead = document.getElementById("letterhead");
  const headerDataUrl = letterhead && String(letterhead.src || "").startsWith("data:") ? letterhead.src : "";
  showBusy("Saving the bill", "Creating the edited PDF…", 0.2);
  let editedPdfBuffer = null;
  let editedPdfName = "";
  try {
    const built = await buildEditedPdf((detail, progress) => {
      showBusy("Saving the bill", detail || "Creating the edited PDF…", progress == null ? 0.5 : 0.2 + progress * 0.7);
    });
    editedPdfBuffer = await built.blob.arrayBuffer();
    editedPdfName = built.fileName;
  } catch (error) {
    console.error(error);
    hideBusy();
    source.postMessage({
      type: "anjani-save",
      requestId,
      error: "Could not create the edited PDF. Try Download PDF first, then Save again.",
    }, location.origin);
    return;
  }
  hideBusy();
  source.postMessage({
    type: "anjani-save",
    requestId,
    bill,
    headerDataUrl,
    pdfName: sourcePdfFile ? sourcePdfFile.name : "",
    pdfBuffer,
    editedPdfName,
    editedPdfBuffer,
  }, location.origin);
}

function boot() {
  applyEditorTitle();
  applyStoredHeader();
  showEditor(false);
  applyTextStyle();

  document.getElementById("sheet").addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.row) syncRowFromInput(input);
    if (input.id === "bill") setField("words", billWords(moneyToPaise(input.value)));
    if (input.classList.contains("total-label") || input.id === "words" || (input.classList.contains("total-num") && input.id !== "fuel")) {
      saveSoon();
      return;
    }
    recalc();
    saveSoon();
  });

  document.getElementById("sheet").addEventListener("focusout", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.classList.contains("amount") || TOTAL_IDS.includes(input.id)) {
      input.value = input.value.trim() === "" ? "" : formatAmount(input.value);
      if (input.id === "bill") setField("words", billWords(moneyToPaise(input.value)));
    } else if (input.classList.contains("weight")) {
      input.value = formatWeight(input.value);
    } else {
      return;
    }
    if (input.dataset.row) syncRowFromInput(input);
    if (TOTAL_IDS.includes(input.id) && input.id !== "fuel") {
      saveSoon();
      return;
    }
    recalc();
    saveSoon();
  });

  document.getElementById("rows").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("amount")) return;
    event.preventDefault();
    const index = state.rows.findIndex((row) => String(row.id) === input.dataset.row);
    const next = state.rows[index + 1];
    if (!next) return;
    const nextWeight = document.querySelector('input.weight[data-row="' + next.id + '"]');
    if (nextWeight) {
      nextWeight.focus();
      nextWeight.select();
    }
  });

  document.getElementById("rows").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button || state.rows.length === 1) return;
    const row = state.rows.find((item) => String(item.id) === button.dataset.remove);
    const which = row && row.docNo ? "DOC " + row.docNo : "this row";
    const ok = await askConfirm("Remove this row?", "Remove " + which + "? The totals will update.");
    if (!ok) return;
    state.rows = state.rows.filter((item) => String(item.id) !== button.dataset.remove);
    renderRows();
    recalc();
    saveSoon();
  });

  document.getElementById("addRow").addEventListener("click", () => {
    const row = blankRow();
    state.rows.push(row);
    renderRows();
    recalc();
    saveSoon();
    const date = document.querySelector('input[data-row="' + row.id + '"][data-field="date"]');
    if (date) {
      date.focus();
      date.scrollIntoView({ block: "nearest" });
    }
  });

  document.getElementById("emptyUpload").addEventListener("click", () => {
    document.getElementById("pdfFile").click();
  });

  document.getElementById("pdfFile").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const controls = ["pdfFile", "addRow", "download"];
    controls.forEach((id) => {
      document.getElementById(id).disabled = true;
    });
    document.getElementById("uploadLabel").style.pointerEvents = "none";
    try {
      await importPdf(file);
    } catch (error) {
      console.error(error);
      setUploadStatus("Could not read that PDF. Use an invoice in this same layout and try again.", true);
    } finally {
      hideBusy();
      document.getElementById("pdfFile").disabled = false;
      document.getElementById("addRow").disabled = false;
      document.getElementById("uploadLabel").style.pointerEvents = "";
      document.getElementById("download").disabled = document.getElementById("editor").hidden;
    }
  });

  document.getElementById("download").addEventListener("click", downloadPdf);

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || !event.data) return;
    if (event.data.type === "anjani-load") applyIncomingBill(event.data);
    if (event.data.type === "anjani-save-request" && event.source) {
      replyWithBill(event.data.requestId, event.source);
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculate, inWords, billWords, formatPaise, roundBillPaise, moneyToPaise, parseInvoice, SAMPLE };
}

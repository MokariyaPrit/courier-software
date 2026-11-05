'use client';

import { BookingType } from '@courier/shared';
import { mediaUrl } from '@/lib/media-url';
import { serviceTypeLabel } from '@/lib/quotations';

export type BookingReceiptDoc = {
  consignment: {
    id: string;
    awb: string;
    bookingType: BookingType;
    bookingDate: string | null;
    createdAt: string;
    senderName: string;
    senderPhone?: string | null;
    senderAddress?: string | null;
    receiverName: string;
    receiverPhone?: string | null;
    receiverAddress?: string | null;
    receiverCity?: string | null;
    receiverState?: string | null;
    receiverPincode?: string | null;
    rateSectionId?: string | null;
    weightKg: string;
    price: string;
    basePrice?: string | null;
    cgst?: string | null;
    sgst?: string | null;
    igst?: string | null;
  };
  letterhead: {
    companyName: string;
    fullName?: string | null;
    phone?: string | null;
    gstin?: string | null;
    city?: string | null;
    state?: string | null;
    logoUrl?: string | null;
  };
};

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const raw = String(iso).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

function formatTimeFromCreatedAt(createdAt?: string | null) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function partyBlock(name: string, phone?: string | null, address?: string | null) {
  const lines = [name];
  if (phone?.trim()) lines.push(phone.trim());
  if (address?.trim()) lines.push(address.trim());
  return lines.join('\n');
}

function money(v?: string | number | null) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return '';
  // Plain digits for the slip (no ₹, no thousand separators)
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(2)));
}

function weightDisplay(kg?: string | null) {
  const n = Number(kg ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1) return `${Math.round(n * 1000)} G`;
  return `${n} KG`;
}

export function BookingReceiptSlip({ doc }: { doc: BookingReceiptDoc }) {
  const { consignment: c, letterhead: lh } = doc;
  const company = lh.companyName || '—';
  const phone = lh.phone?.trim() || '';
  const title =
    c.bookingType === BookingType.ACCOUNT ? 'ACCOUNT RECEIPT' : 'CASH RECEIPT';
  const origin = (lh.city || '').trim().toUpperCase() || '—';
  const destination = [c.receiverCity, c.receiverState]
    .filter(Boolean)
    .join(', ')
    .toUpperCase();
  const mode = c.rateSectionId
    ? serviceTypeLabel(c.rateSectionId).toUpperCase()
    : '';
  const freight = money(c.basePrice ?? c.price);
  const total = money(c.price);
  const cgst = Number(c.cgst ?? 0);
  const sgst = Number(c.sgst ?? 0);
  const igst = Number(c.igst ?? 0);
  const gstTotal = cgst + sgst + igst;
  const showGst =
    c.bookingType === BookingType.CASH &&
    Number.isFinite(gstTotal) &&
    gstTotal > 0.001;
  const gstLines: string[] = [];
  if (showGst) {
    if (cgst > 0.001) gstLines.push(`CGST - ${money(cgst)}`);
    if (sgst > 0.001) gstLines.push(`SGST - ${money(sgst)}`);
    if (igst > 0.001) gstLines.push(`IGST - ${money(igst)}`);
    gstLines.push(`total - ${money(gstTotal)}`);
  }
  const logoSrc = mediaUrl(lh.logoUrl);

  return (
    <div className="br-sheet">
      <div className="br-slip">
        <div className="br-slip-inner">
          <header className="br-slip-head">
            <div className="br-header-logo-frame">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="br-header-logo" src={logoSrc} alt={company} />
              ) : (
                <div className="br-header-logo-fallback">{company}</div>
              )}
            </div>
            <div className="br-cash">
              <strong>{title}</strong>
              <span>ISSUED BY {company.toUpperCase()}</span>
              {lh.gstin ? (
                <span className="br-cash-gst">GST No. {lh.gstin}</span>
              ) : null}
            </div>
          </header>

          <div className="br-franchisee">
            <span>
              FRANCHISEE : {company.toUpperCase()}
              {phone ? `     Mo. : ${phone}` : ''}
            </span>
          </div>

          <div className="br-route">
            <div className="br-cell">
              <span className="br-lbl">ORIGIN</span>
              <span className="br-origin">{origin}</span>
            </div>
            <div className="br-cell">
              <span className="br-lbl">DESTINATION</span>
              <span className="br-val">{destination}</span>
            </div>
            <div className="br-cell">
              <span className="br-lbl">DATE</span>
              <span className="br-val">{formatDate(c.bookingDate)}</span>
            </div>
            <div className="br-cell">
              <span className="br-lbl">AWB NUMBER</span>
              <span className="br-val">{c.awb}</span>
            </div>
          </div>

          <div className="br-parties">
            <div className="br-party">
              <div className="br-vlabel" aria-hidden="true">
                <span>F</span>
                <span>R</span>
                <span>O</span>
                <span>M</span>
              </div>
              <div className="br-party-body">
                <div className="br-val br-grow">
                  {partyBlock(c.senderName, c.senderPhone, c.senderAddress)}
                </div>
              </div>
            </div>
            <div className="br-party">
              <div className="br-vlabel" aria-hidden="true">
                <span>T</span>
                <span>O</span>
              </div>
              <div className="br-party-body">
                <div className="br-val br-grow">
                  {partyBlock(
                    c.receiverName,
                    c.receiverPhone,
                    c.receiverAddress,
                  )}
                </div>
              </div>
            </div>
          </div>

          <table className={`br-charges${showGst ? ' br-charges--gst' : ''}`}>
            <colgroup>
              {showGst ? (
                <>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                </>
              ) : (
                <>
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '26%' }} />
                </>
              )}
            </colgroup>
            <tbody>
              <tr>
                <th>MODE OF TRANSPORT</th>
                <th>DECLARED VALUE</th>
                <th>WEIGHT</th>
                <th>FREIGHT CHARGE</th>
                {showGst ? <th>GST</th> : null}
                <th>TOTAL AMOUNT</th>
              </tr>
              <tr>
                <td className="br-val br-left">{mode}</td>
                <td className="br-val">—</td>
                <td className="br-val">{weightDisplay(c.weightKg)}</td>
                <td className="br-val">{freight}</td>
                {showGst ? (
                  <td className="br-val br-gst-cell">
                    <div className="br-gst-stack">
                      {gstLines.map((line) => (
                        <span key={line} className="br-gst-line">
                          {line}
                        </span>
                      ))}
                    </div>
                  </td>
                ) : null}
                <td className="br-val">{total}</td>
              </tr>
            </tbody>
          </table>

          <footer className="br-slip-foot">
            <div className="br-foot-left">
              <p className="br-terms">
                I HEREBY AGREE WITH THE TERMS AND CONDITIONS SET FORTH ON THE
                REVERSE SIDE OF THIS NON-NEGOTIABLE CONSIGNMENT NOTE AND WARRANT
                THAT THE INFORMATION DECLARED BY ME IN THIS MEMO IS TRUE AND
                CORRECT.
              </p>
              <div className="br-sign-row">
                <strong>SENDERS SIGNATURE</strong>
                <strong className="br-no-ins">! NO INSURANCE !</strong>
              </div>
              <div className="br-warrant">
                I Warrant that all details given herein are true and correct
              </div>
              <div className="br-left-bottom">
                <div className="br-time-line">
                  TIME :{' '}
                  <span className="br-val">
                    {formatTimeFromCreatedAt(c.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="br-foot-right">
              <div className="br-foot-right-top">
                <div className="br-recv-head">
                  <span>RECEIVER&apos;S SIGNATURE &amp; RUBBER STAMP</span>
                  <span className="br-date-slot">DATE :</span>
                </div>
                <div className="br-recv-name">
                  <span className="br-name-lbl">NAME :</span>
                  <span className="br-val" />
                  <span className="br-ampm-slot">
                    <span className="br-ampm-hint">A.M. / P.M.</span>
                  </span>
                </div>
                <div className="br-good-order">
                  Received in good order and condition
                </div>
              </div>
              <table className="br-foot-band">
                <tbody>
                  <tr>
                    <td className="br-note">
                      <strong>Note :</strong> Cash, Gold, Silver, Diamond, Liquid
                      &amp; IATA Rest. Item are not Accepted By Us.{' '}
                      <strong>DO NOT KEEP CASH IN THE ENVELOPE.</strong>
                    </td>
                    <td className="br-recv-by">
                      <span>RECEIVED BY</span>
                      <strong>{company.toUpperCase()}</strong>
                      {phone ? <span>Mo. : {phone}</span> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

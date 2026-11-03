'use client';

import { Button, InputNumber, Select } from '@/components/ui';
import {
  emptyRatesForColumns,
  isParcelService,
  newId,
  RATE_SERVICE_OPTIONS,
  RateMatrixForm,
  RateRowForm,
  serviceTypeLabel,
  weightLabelForGrams,
  weightOptionsForSection,
} from '@/lib/quotations';

type Props = {
  value: RateMatrixForm;
  onChange: (next: RateMatrixForm) => void;
  readOnly?: boolean;
  /** Geography columns from Rate columns — labels locked */
  lockColumns?: boolean;
};

export function RateMatrixEditor({
  value,
  onChange,
  readOnly,
  lockColumns = true,
}: Props) {
  const { columns, sections, rows } = value;

  const setMatrix = (patch: Partial<RateMatrixForm>) => {
    onChange({ ...value, ...patch });
  };

  const usedSectionIds = new Set(sections.map((s) => s.id));
  const availableServices = RATE_SERVICE_OPTIONS.filter(
    (o) => !usedSectionIds.has(o.value),
  );

  const addSection = (serviceId: string) => {
    if (!serviceId || usedSectionIds.has(serviceId)) return;
    const weightOpts = weightOptionsForSection(serviceId);
    const first = weightOpts[0];
    setMatrix({
      sections: [
        ...sections,
        {
          id: serviceId,
          label: serviceTypeLabel(serviceId),
          sortOrder: sections.length,
        },
      ],
      rows: [
        ...rows,
        {
          id: newId('row'),
          sectionId: serviceId,
          weightLabel: first
            ? weightLabelForGrams(serviceId, first.value)
            : '100 g',
          weightGrams: first?.value ?? 100,
          isAdditional: false,
          sortOrder: 1,
          rates: emptyRatesForColumns(columns),
        },
      ],
    });
  };

  const changeSectionType = (oldId: string, newId: string) => {
    if (!newId || oldId === newId) return;
    if (usedSectionIds.has(newId)) return;
    const opts = weightOptionsForSection(newId);
    setMatrix({
      sections: sections.map((s) =>
        s.id === oldId
          ? { ...s, id: newId, label: serviceTypeLabel(newId) }
          : s,
      ),
      rows: rows.map((r) => {
        if (r.sectionId !== oldId) return r;
        const grams = Math.min(r.weightGrams ?? opts[0]?.value ?? 100, 1000);
        const match =
          opts.find((o) => o.value === grams) ||
          opts.find((o) => o.value >= grams) ||
          opts[opts.length - 1];
        return {
          ...r,
          sectionId: newId,
          weightGrams: match?.value ?? grams,
          weightLabel: match?.label ?? weightLabelForGrams(newId, grams),
          isAdditional: false,
        };
      }),
    });
  };

  const removeSection = (sectionId: string) => {
    setMatrix({
      sections: sections
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, sortOrder: i })),
      rows: rows.filter((r) => r.sectionId !== sectionId),
    });
  };

  const addRow = (sectionId: string) => {
    const sectionRows = rows.filter((r) => r.sectionId === sectionId);
    const usedWeights = new Set(
      sectionRows.map((r) => r.weightGrams).filter((g) => g != null),
    );
    const nextWeight = weightOptionsForSection(sectionId).find(
      (o) => !usedWeights.has(o.value),
    );
    if (!nextWeight) return;
    const nextSort =
      sectionRows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
    const row: RateRowForm = {
      id: newId('row'),
      sectionId,
      weightLabel: nextWeight.label,
      weightGrams: nextWeight.value,
      isAdditional: false,
      sortOrder: nextSort,
      rates: emptyRatesForColumns(columns),
    };
    setMatrix({ rows: [...rows, row] });
  };

  const removeRow = (rowKey: string) => {
    setMatrix({
      rows: rows.filter((r) => rowIdentity(r) !== rowKey),
    });
  };

  const updateRowWeight = (rowKey: string, weightGrams: number) => {
    setMatrix({
      rows: rows.map((r) => {
        if (rowIdentity(r) !== rowKey) return r;
        return {
          ...r,
          weightGrams,
          weightLabel: weightLabelForGrams(r.sectionId, weightGrams),
          isAdditional: false,
        };
      }),
    });
  };

  const updateCell = (rowKey: string, colId: string, amount: number | null) => {
    setMatrix({
      rows: rows.map((r) =>
        rowIdentity(r) === rowKey
          ? {
              ...r,
              rates: {
                ...r.rates,
                [colId]:
                  amount === null || Number.isNaN(amount)
                    ? ('' as unknown as number)
                    : amount,
              },
            }
          : r,
      ),
    });
  };

  const moveColumn = (colId: string, direction: -1 | 1) => {
    const index = columns.findIndex((c) => c.id === colId);
    if (index < 0) return;
    const next = index + direction;
    if (next < 0 || next >= columns.length) return;
    const reordered = [...columns];
    const [col] = reordered.splice(index, 1);
    reordered.splice(next, 0, col);
    setMatrix({
      columns: reordered.map((c, i) => ({ ...c, sortOrder: i })),
    });
  };

  return (
    <div className="rate-matrix">
      {!readOnly ? (
        <div className="rate-matrix-toolbar">
          <div style={{ minWidth: '16rem', maxWidth: '22rem' }}>
            <Select
              value={null}
              options={availableServices}
              placeholder={
                availableServices.length
                  ? 'Add section (DOX / PARCEL / …)'
                  : 'All 5 sections added'
              }
              disabled={!availableServices.length}
              onChange={(e) => {
                if (e.value) addSection(String(e.value));
              }}
              style={{ width: '100%' }}
            />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Sections are fixed: DOX, PARCEL, DOX BY AIR, PARCEL BY AIR, TATKAL.
            Use the arrows on column headers to reorder destinations. DOX-type
            weights are in g (max 1000 g); parcel weights are in kg (max 1 kg).
          </p>
        </div>
      ) : null}

      {lockColumns && !readOnly && columns.length === 0 ? (
        <p className="muted">
          No rate columns yet. Select destination cities under Rate columns,
          then reopen this page — city columns and ROI are added automatically.
        </p>
      ) : null}

      {sections.map((section) => {
        const sectionRows = rows
          .filter((r) => r.sectionId === section.id && !r.isAdditional)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const unit = isParcelService(section.id) ? 'kg' : 'g';
        const weightOpts = weightOptionsForSection(section.id).map((o) => ({
          label: o.label,
          value: o.value,
        }));
        const usedInSection = new Set(
          sectionRows.map((r) => r.weightGrams).filter((g) => g != null),
        );

        return (
          <section key={section.id} className="rate-matrix-section">
            <div className="rate-matrix-section-head">
              {readOnly ? (
                <h3>{serviceTypeLabel(section.id)}</h3>
              ) : (
                <Select
                  value={section.id}
                  options={RATE_SERVICE_OPTIONS.filter(
                    (o) =>
                      o.value === section.id || !usedSectionIds.has(o.value),
                  )}
                  onChange={(e) =>
                    changeSectionType(section.id, String(e.value || ''))
                  }
                  className="rate-matrix-section-title"
                  style={{ minWidth: '14rem' }}
                />
              )}
              {!readOnly ? (
                <div className="rate-matrix-section-actions">
                  <Button
                    type="button"
                    size="small"
                    text
                    icon="pi pi-plus"
                    label={`Add weight (${unit})`}
                    onClick={() => addRow(section.id)}
                    disabled={usedInSection.size >= weightOpts.length}
                  />
                  <Button
                    type="button"
                    size="small"
                    text
                    severity="danger"
                    icon="pi pi-trash"
                    label="Remove section"
                    onClick={() => removeSection(section.id)}
                  />
                </div>
              ) : null}
            </div>

            <div className="rate-matrix-scroll">
              <table className="rate-matrix-table">
                <thead>
                  <tr>
                    <th>Weight ({unit})</th>
                    {columns.map((col, colIndex) => (
                      <th key={col.id}>
                        {readOnly ? (
                          col.label
                        ) : (
                          <div className="rate-matrix-col-head">
                            <button
                              type="button"
                              className="rate-matrix-col-move"
                              title="Move column left"
                              aria-label={`Move ${col.label} left`}
                              disabled={colIndex === 0}
                              onClick={() => moveColumn(col.id, -1)}
                            >
                              <i className="pi pi-arrow-left" aria-hidden />
                            </button>
                            <span className="rate-matrix-col-label">
                              {col.label}
                            </span>
                            <button
                              type="button"
                              className="rate-matrix-col-move"
                              title="Move column right"
                              aria-label={`Move ${col.label} right`}
                              disabled={colIndex === columns.length - 1}
                              onClick={() => moveColumn(col.id, 1)}
                            >
                              <i className="pi pi-arrow-right" aria-hidden />
                            </button>
                          </div>
                        )}
                      </th>
                    ))}
                    {!readOnly ? (
                      <th className="rate-matrix-actions-col" />
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + (readOnly ? 1 : 2)}
                        className="muted"
                      >
                        No weight rows — add a weight band
                      </td>
                    </tr>
                  ) : (
                    sectionRows.map((row) => {
                      const key = rowIdentity(row);
                      const rowOpts = weightOpts.filter(
                        (o) =>
                          o.value === row.weightGrams ||
                          !usedInSection.has(Number(o.value)),
                      );
                      return (
                        <tr key={key}>
                          <td className="weight-cell">
                            {readOnly ? (
                              row.weightLabel
                            ) : (
                              <Select
                                value={row.weightGrams}
                                options={rowOpts}
                                onChange={(e) =>
                                  updateRowWeight(key, Number(e.value))
                                }
                                style={{ width: '8rem' }}
                              />
                            )}
                          </td>
                          {columns.map((col) => {
                            const raw = row.rates[col.id];
                            const hasValue =
                              raw !== undefined &&
                              raw !== null &&
                              String(raw).trim() !== '';
                            return (
                              <td key={col.id}>
                                {readOnly ? (
                                  <span>
                                    {hasValue ? Number(raw).toFixed(2) : '—'}
                                  </span>
                                ) : (
                                  <InputNumber
                                    value={hasValue ? Number(raw) : null}
                                    onValueChange={(e) =>
                                      updateCell(
                                        key,
                                        col.id,
                                        e.value === null ||
                                          e.value === undefined
                                          ? null
                                          : Number(e.value),
                                      )
                                    }
                                    min={0}
                                    minFractionDigits={0}
                                    maxFractionDigits={2}
                                    inputStyle={{ width: '5.5rem' }}
                                    placeholder="—"
                                  />
                                )}
                              </td>
                            );
                          })}
                          {!readOnly ? (
                            <td>
                              <Button
                                type="button"
                                size="small"
                                text
                                severity="danger"
                                icon="pi pi-trash"
                                aria-label="Remove row"
                                onClick={() => removeRow(key)}
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {!readOnly && sections.length === 0 ? (
        <p className="muted">
          No sections yet. Choose a service type above to start.
        </p>
      ) : null}
    </div>
  );
}

function rowIdentity(row: RateRowForm) {
  return row.id || `${row.sectionId}:${row.sortOrder}:${row.weightGrams}`;
}

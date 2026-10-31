'use client';

import { Button, InputNumber, InputText } from '@/components/ui';
import {
  emptyRatesForColumns,
  newId,
  RateMatrixForm,
  RateRowForm,
} from '@/lib/quotations';

type Props = {
  value: RateMatrixForm;
  onChange: (next: RateMatrixForm) => void;
  readOnly?: boolean;
  /** Geography columns from Centers — labels locked, no add/remove columns */
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

  const renameColumn = (colId: string, label: string) => {
    if (lockColumns) return;
    setMatrix({
      columns: columns.map((c) => (c.id === colId ? { ...c, label } : c)),
    });
  };

  const addColumn = () => {
    if (lockColumns) return;
    const id = newId('col');
    const nextColumns = [
      ...columns,
      { id, label: `New column`, sortOrder: columns.length },
    ];
    setMatrix({
      columns: nextColumns,
      rows: rows.map((r) => ({
        ...r,
        rates: { ...r.rates, [id]: 0 },
      })),
    });
  };

  const removeColumn = (colId: string) => {
    if (lockColumns) return;
    setMatrix({
      columns: columns
        .filter((c) => c.id !== colId)
        .map((c, i) => ({ ...c, sortOrder: i })),
      rows: rows.map((r) => {
        const rates = { ...r.rates };
        delete rates[colId];
        return { ...r, rates };
      }),
    });
  };

  const renameSection = (sectionId: string, label: string) => {
    setMatrix({
      sections: sections.map((s) =>
        s.id === sectionId ? { ...s, label } : s,
      ),
    });
  };

  const addSection = () => {
    const id = newId('sec');
    setMatrix({
      sections: [
        ...sections,
        { id, label: 'New section', sortOrder: sections.length },
      ],
      rows: [
        ...rows,
        {
          id: newId('row'),
          sectionId: id,
          weightLabel: 'Up to 100 gms',
          weightGrams: 100,
          isAdditional: false,
          sortOrder: 1,
          rates: emptyRatesForColumns(columns),
        },
      ],
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
    const nextSort =
      sectionRows.reduce((max, r) => Math.max(max, r.sortOrder), 0) + 1;
    const row: RateRowForm = {
      id: newId('row'),
      sectionId,
      weightLabel: 'New weight',
      weightGrams: null,
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

  const updateRowLabel = (rowKey: string, weightLabel: string) => {
    setMatrix({
      rows: rows.map((r) =>
        rowIdentity(r) === rowKey ? { ...r, weightLabel } : r,
      ),
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
                [colId]: amount === null || Number.isNaN(amount) ? ('' as unknown as number) : amount,
              },
            }
          : r,
      ),
    });
  };

  return (
    <div className="rate-matrix">
      {!readOnly ? (
        <div className="rate-matrix-toolbar">
          {!lockColumns ? (
            <Button
              type="button"
              size="small"
              label="Add column"
              icon="pi pi-plus"
              outlined
              onClick={addColumn}
            />
          ) : null}
          <Button
            type="button"
            size="small"
            label="Add section"
            icon="pi pi-plus"
            outlined
            onClick={addSection}
          />
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
          .filter((r) => r.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <section key={section.id} className="rate-matrix-section">
            <div className="rate-matrix-section-head">
              {readOnly ? (
                <h3>{section.label}</h3>
              ) : (
                <InputText
                  value={section.label}
                  onChange={(e) => renameSection(section.id, e.target.value)}
                  className="rate-matrix-section-title"
                  aria-label="Section name"
                />
              )}
              {!readOnly ? (
                <div className="rate-matrix-section-actions">
                  <Button
                    type="button"
                    size="small"
                    text
                    icon="pi pi-plus"
                    label="Add row"
                    onClick={() => addRow(section.id)}
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
                    <th>Weight</th>
                    {columns.map((col) => (
                      <th key={col.id}>
                        {readOnly || lockColumns ? (
                          col.label
                        ) : (
                          <div className="rate-matrix-col-head">
                            <InputText
                              value={col.label}
                              onChange={(e) =>
                                renameColumn(col.id, e.target.value)
                              }
                              aria-label="Column name"
                            />
                            <Button
                              type="button"
                              size="small"
                              text
                              severity="danger"
                              icon="pi pi-times"
                              aria-label="Remove column"
                              onClick={() => removeColumn(col.id)}
                              disabled={columns.length <= 1}
                            />
                          </div>
                        )}
                      </th>
                    ))}
                    {!readOnly ? <th className="rate-matrix-actions-col" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sectionRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + (readOnly ? 1 : 2)}
                        className="muted"
                      >
                        No rows in this section
                      </td>
                    </tr>
                  ) : (
                    sectionRows.map((row) => {
                      const key = rowIdentity(row);
                      return (
                        <tr key={key}>
                          <td className="weight-cell">
                            {readOnly ? (
                              row.weightLabel
                            ) : (
                              <InputText
                                value={row.weightLabel}
                                onChange={(e) =>
                                  updateRowLabel(key, e.target.value)
                                }
                                aria-label="Weight label"
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
                                    {hasValue
                                      ? Number(raw).toFixed(2)
                                      : '—'}
                                  </span>
                                ) : (
                                  <InputNumber
                                    value={hasValue ? Number(raw) : null}
                                    onValueChange={(e) =>
                                      updateCell(
                                        key,
                                        col.id,
                                        e.value === null || e.value === undefined
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
          No sections yet. Click <strong>Add section</strong> to start.
        </p>
      ) : null}
    </div>
  );
}

function rowIdentity(row: RateRowForm) {
  return row.id || `${row.sectionId}:${row.sortOrder}:${row.weightLabel}`;
}

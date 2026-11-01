'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { ListSearch } from '@/components/ListControls';
import { api, unwrap } from '@/lib/api';

type CityChip = { id: string; name: string; selected: boolean };
type StateGroup = {
  stateId: string;
  stateName: string;
  cities: CityChip[];
};
type Board = {
  groups: StateGroup[];
  selectedCityIds: string[];
};

export default function RateColumnsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState('');

  const boardQuery = useQuery({
    queryKey: ['rate-columns-board'],
    queryFn: async () => {
      const res = await api.get('/rate-columns/board');
      const payload = unwrap<{ data: Board } | Board>(res.data);
      if (payload && typeof payload === 'object' && 'groups' in payload) {
        return payload as Board;
      }
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as { data: Board }).data;
      }
      return { groups: [], selectedCityIds: [] };
    },
  });

  useEffect(() => {
    if (!boardQuery.data) return;
    setSelected(new Set(boardQuery.data.selectedCityIds));
    setDirty(false);
  }, [boardQuery.data]);

  const groups = boardQuery.data?.groups ?? [];
  const searchQ = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!searchQ) return groups;
    return groups
      .map((g) => {
        const stateMatch = g.stateName.toLowerCase().includes(searchQ);
        const cities = stateMatch
          ? g.cities
          : g.cities.filter((c) => c.name.toLowerCase().includes(searchQ));
        return { ...g, cities };
      })
      .filter((g) => g.cities.length > 0);
  }, [groups, searchQ]);

  const selectedCount = selected.size;

  const toggleCity = (cityId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
    setDirty(true);
    setSavedHint('');
  };

  const selectAllInState = (group: StateGroup) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of group.cities) next.add(c.id);
      return next;
    });
    setDirty(true);
    setSavedHint('');
  };

  const clearState = (group: StateGroup) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of group.cities) next.delete(c.id);
      return next;
    });
    setDirty(true);
    setSavedHint('');
  };

  const toggleCollapse = (stateId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stateId)) next.delete(stateId);
      else next.add(stateId);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/rate-columns/selection', {
        cityIds: Array.from(selected),
      });
    },
    onSuccess: async () => {
      setError('');
      setSavedHint('Rate columns saved — cash & quotation templates will sync');
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['rate-columns-board'] });
      await qc.invalidateQueries({ queryKey: ['cash-rates-mine'] });
      await qc.invalidateQueries({ queryKey: ['quotation-templates'] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save rate columns',
      );
    },
  });

  const summary = useMemo(() => {
    const names: string[] = [];
    for (const g of groups) {
      for (const c of g.cities) {
        if (selected.has(c.id)) names.push(`${c.name} (${g.stateName})`);
      }
    }
    return names;
  }, [groups, selected]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rate columns</h1>
          <p className="muted" style={{ margin: 0 }}>
            Choose destination cities for your rate matrices. Each selected
            city becomes a column, plus ROI. Separate from Centers (booking
            sender locations).
          </p>
        </div>
        <Button
          label={dirty ? 'Save selection' : 'Saved'}
          icon="pi pi-save"
          disabled={!dirty && !saveMutation.isPending}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        />
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <strong>{selectedCount}</strong> cities selected
        {summary.length ? (
          <p className="muted" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
            {summary.slice(0, 12).join(' · ')}
            {summary.length > 12 ? ` · +${summary.length - 12} more` : ''}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            No cities selected — matrices will only have the ROI column until
            you pick destinations here.
          </p>
        )}
      </div>

      <ListSearch
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search state or city…"
      />

      {boardQuery.isLoading ? <p>Loading states &amp; cities…</p> : null}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {filteredGroups.map((group) => {
          const isCollapsed = !searchQ && collapsed.has(group.stateId);
          const fullGroup =
            groups.find((g) => g.stateId === group.stateId) ?? group;
          const selectedInState = fullGroup.cities.filter((c) =>
            selected.has(c.id),
          ).length;
          return (
            <section key={group.stateId} className="panel" style={{ padding: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  padding: '0.75rem 1rem',
                  borderBottom: isCollapsed
                    ? 'none'
                    : '1px solid var(--main-border, #e2e6ee)',
                }}
              >
                <button
                  type="button"
                  className="nav-link"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleCollapse(group.stateId)}
                >
                  <i
                    className={`pi ${isCollapsed ? 'pi-chevron-right' : 'pi-chevron-down'}`}
                  />{' '}
                  <strong>{group.stateName}</strong>
                  <span className="muted" style={{ marginLeft: '0.5rem' }}>
                    {selectedInState}/{fullGroup.cities.length}
                    {searchQ
                      ? ` · showing ${group.cities.length}`
                      : ''}
                  </span>
                </button>
                <div
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    gap: '0.35rem',
                  }}
                >
                  <Button
                    size="small"
                    text
                    label="Select all"
                    onClick={() => selectAllInState(group)}
                  />
                  <Button
                    size="small"
                    text
                    severity="secondary"
                    label="Clear"
                    onClick={() => clearState(fullGroup)}
                  />
                </div>
              </div>
              {!isCollapsed ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    padding: '0.85rem 1rem 1rem',
                  }}
                >
                  {group.cities.length === 0 ? (
                    <span className="muted">No cities in this state</span>
                  ) : (
                    group.cities.map((city) => {
                      const on = selected.has(city.id);
                      return (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => toggleCity(city.id)}
                          style={{
                            border: `1px solid ${on ? '#2a5f9e' : 'var(--main-border, #c5ced8)'}`,
                            background: on ? '#e8f0fa' : '#fff',
                            color: '#1f2937',
                            borderRadius: '999px',
                            padding: '0.35rem 0.7rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: on ? 600 : 500,
                          }}
                        >
                          {city.name}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
        {!boardQuery.isLoading && searchQ && filteredGroups.length === 0 ? (
          <p className="muted">No states or cities match “{search.trim()}”.</p>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {savedHint ? <p className="muted">{savedHint}</p> : null}
    </div>
  );
}

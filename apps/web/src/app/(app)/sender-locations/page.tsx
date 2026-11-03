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
  defaultCityId: string | null;
};

export default function SenderLocationsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultCityId, setDefaultCityId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [savedHint, setSavedHint] = useState('');

  const boardQuery = useQuery({
    queryKey: ['sender-locations-board'],
    queryFn: async () => {
      const res = await api.get('/sender-locations/board');
      const payload = unwrap<{ data: Board } | Board>(res.data);
      if (payload && typeof payload === 'object' && 'groups' in payload) {
        return payload as Board;
      }
      if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as { data: Board }).data;
      }
      return { groups: [], selectedCityIds: [], defaultCityId: null };
    },
  });

  useEffect(() => {
    if (!boardQuery.data) return;
    setSelected(new Set(boardQuery.data.selectedCityIds));
    setDefaultCityId(boardQuery.data.defaultCityId);
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
      if (next.has(cityId)) {
        next.delete(cityId);
        if (defaultCityId === cityId) {
          const first = next.values().next().value as string | undefined;
          setDefaultCityId(first ?? null);
        }
      } else {
        next.add(cityId);
        if (!defaultCityId) setDefaultCityId(cityId);
      }
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

  const allCityIds = useMemo(
    () => groups.flatMap((g) => g.cities.map((c) => c.id)),
    [groups],
  );

  const selectAllCenters = () => {
    if (!allCityIds.length) return;
    setSelected(new Set(allCityIds));
    setDefaultCityId((prev) => prev || allCityIds[0] || null);
    setDirty(true);
    setSavedHint('');
  };

  const clearAllCenters = () => {
    setSelected(new Set());
    setDefaultCityId(null);
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
      await api.put('/sender-locations/selection', {
        cityIds: Array.from(selected),
        defaultCityId: defaultCityId || null,
      });
    },
    onSuccess: async () => {
      setError('');
      setSavedHint('Centers saved');
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ['sender-locations-board'] });
      await qc.invalidateQueries({ queryKey: ['sender-locations'] });
      await qc.invalidateQueries({ queryKey: ['sender-locations-booking'] });
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message || 'Failed to save centers',
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
          <h1>Centers</h1>
          <p className="muted" style={{ margin: 0 }}>
            Select cities you operate from — these are booking sender locations
            only. Rate matrix columns are configured separately under Rate
            columns.
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <strong>{selectedCount}</strong>
          <span className="muted">
            of {allCityIds.length} cities selected
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
            <Button
              size="small"
              outlined
              label="Select all centers"
              icon="pi pi-check-square"
              disabled={!allCityIds.length || selectedCount === allCityIds.length}
              onClick={selectAllCenters}
            />
            <Button
              size="small"
              outlined
              severity="secondary"
              label="Clear all"
              disabled={selectedCount === 0}
              onClick={clearAllCenters}
            />
          </div>
        </div>
        {summary.length ? (
          <p className="muted" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
            {summary.slice(0, 12).join(' · ')}
            {summary.length > 12 ? ` · +${summary.length - 12} more` : ''}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 0, marginTop: '0.35rem' }}>
            No cities selected yet.
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
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
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
                      const isDefault = defaultCityId === city.id;
                      return (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => toggleCity(city.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (!selected.has(city.id)) return;
                            setDefaultCityId(city.id);
                            setDirty(true);
                          }}
                          title={
                            isDefault
                              ? 'Default center'
                              : on
                                ? 'Right-click to set default'
                                : 'Click to select'
                          }
                          style={{
                            border: `1px solid ${on ? '#2a7a55' : 'var(--main-border, #c5ced8)'}`,
                            background: on ? '#e8f5ef' : '#fff',
                            color: '#1f2937',
                            borderRadius: '999px',
                            padding: '0.35rem 0.7rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: isDefault ? 700 : 500,
                          }}
                        >
                          {city.name}
                          {isDefault ? ' ★' : ''}
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

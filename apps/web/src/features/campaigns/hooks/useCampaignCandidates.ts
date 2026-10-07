import { skipToken } from '@reduxjs/toolkit/query';
import type { CampaignListingDto } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetCampaignCandidatesQuery, useLazyGetCampaignCandidatesQuery } from '../api/campaigns.api';

import { useCampaignRequestScope } from './useCampaignRequestScope';

export function useCampaignCandidates(storeId: string, campaignId: string, writable: boolean) {
  const { t } = useTranslation(['campaigns']);
  const request = useCampaignRequestScope(storeId, campaignId);
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CampaignListingDto[]>([]);
  const [filling, setFilling] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSkipped, setGroupSkipped] = useState<number | null>(null);
  const pending = useRef<ReturnType<ReturnType<typeof useLazyGetCampaignCandidatesQuery>[0]> | null>(null);
  const [fetchCandidates] = useLazyGetCampaignCandidatesQuery();
  const query = useGetCampaignCandidatesQuery(
    writable
      ? {
          ebayAccountId: storeId,
          search: search || undefined,
          listingSettingsGroupId: group || undefined,
          page: page + 1,
          limit: 25,
        }
      : skipToken
  );
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / 25));
  useEffect(() => {
    if (page >= pageCount) {
      setPage(pageCount - 1);
    }
  }, [page, pageCount]);
  useEffect(() => () => pending.current?.abort(), []);
  const cancelFill = () => {
    request.cancel();
    pending.current?.abort();
    pending.current = null;
    setFilling(false);
  };
  const fillGroup = async (id: string) => {
    cancelFill();
    setGroup(id);
    setPage(0);
    setSearch('');
    setGroupError(null);
    setGroupSkipped(null);
    if (!id || !writable || !request.isContextCurrent()) {
      return;
    }
    const isCurrent = request.begin();
    setFilling(true);
    const members = new Map<string, CampaignListingDto>();
    try {
      let nextPage = 1;
      let remaining = true;
      let skipped = 0;
      while (remaining) {
        const fetch = fetchCandidates({
          ebayAccountId: storeId,
          listingSettingsGroupId: id,
          page: nextPage,
          limit: 100,
        });
        pending.current = fetch;
        const result = await fetch.unwrap();
        if (!isCurrent()) {
          return;
        }
        for (const member of result.items) {
          members.set(member.listingId, member);
        }
        skipped = Math.max(skipped, result.skippedInCampaign);
        remaining = result.page * result.limit < result.total;
        if (remaining && (!result.items.length || result.page !== nextPage || result.limit <= 0)) {
          throw new Error('Incomplete candidate page');
        }
        nextPage += 1;
      }
      if (isCurrent()) {
        setSelected([...members.values()]);
        setGroupSkipped(skipped);
      }
    } catch {
      if (isCurrent()) {
        setGroupError(t('campaigns.add.groupError'));
      }
    } finally {
      if (isCurrent()) {
        setFilling(false);
        pending.current = null;
      }
    }
  };
  const onSelection = (rows: CampaignListingDto[]) => {
    cancelFill();
    setGroupError(null);
    setSelected(rows);
  };
  return {
    search,
    group,
    page,
    selected,
    filling,
    groupError,
    query,
    pageCount,
    skipped: groupSkipped ?? query.currentData?.skippedInCampaign ?? null,
    onGroup: (value: string | number) => {
      void fillGroup(String(value));
    },
    onRetryGroup: () => {
      void fillGroup(group);
    },
    onSearch: (value: string) => {
      cancelFill();
      setSearch(value);
      setPage(0);
      setGroupSkipped(null);
    },
    onPage: (value: number) => setPage(value),
    onSelection,
    onAdded: (rows: CampaignListingDto[]) => {
      onSelection(rows);
      setGroupSkipped(null);
    },
    onToggle: (member: CampaignListingDto, checked: boolean) =>
      onSelection(
        checked
          ? [...selected.filter((row) => row.listingId !== member.listingId), member]
          : selected.filter((row) => row.listingId !== member.listingId)
      ),
  };
}

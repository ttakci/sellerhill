import { zodResolver } from '@hookform/resolvers/zod';
import { ListingStatus, PolicyType, updateListingSchema, type PriceRange, type UpdateListingFormData } from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  useDeleteListingsMutation,
  useEndListingsMutation,
  useGetBusinessPoliciesQuery,
  useGetListingByIdQuery,
  useGetListingRevisionsQuery,
  usePublishListingMutation,
  useUpdateListingMutation,
} from '../api/listings.api';

import { ListingDetailPageComponent } from './ListingDetailPage.component';
import type { AutomationStatusItem, ListingOverridesUiState } from './ListingDetailPage.types';

import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { useLocale } from '@/utils/useLocale';

const resolveLabel = (
  options: Array<{ id: string; name: string }>,
  id: string | undefined,
  fallback: string
): string => {
  if (!id) {
    return fallback;
  }
  return options.find((o) => o.id === id)?.name ?? fallback;
};

const emptyOverrides = (): ListingOverridesUiState => ({
  pauseSales: false,
  fixedPrice: false,
  fixedQuantity: false,
  priceOverride: '',
  quantityOverride: '',
  marginPercentOverride: '',
  marginFixedOverride: '',
});

const parseOptionalNumber = (raw: string): number | null => {
  if (raw.trim() === '') {
    return null;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};

/** One-line read of a group's repricing strategy for the Listeleme Ayar Grubu
 *  card — a range (or single value) of whichever margin shape the group's
 *  price ranges actually use. Mixed percent+fixed ranges fall back to a count,
 *  since a min/max across two different units would misrepresent the group. */
const summarizeMarginStrategy = (
  ranges: PriceRange[] | undefined,
  fmtCurrency: (value: number) => string,
  t: TFunction
): string | undefined => {
  if (!ranges || ranges.length === 0) {
    return undefined;
  }
  const percents = ranges
    .map((r) => r.profitMarginPercent)
    .filter((v): v is number => typeof v === 'number');
  const fixedAmounts = ranges
    .map((r) => r.fixedProfitAmount)
    .filter((v): v is number => typeof v === 'number');

  if (percents.length > 0 && fixedAmounts.length === 0) {
    const min = Math.min(...percents);
    const max = Math.max(...percents);
    return min === max ? `%${min}` : `%${min}–%${max}`;
  }
  if (fixedAmounts.length > 0 && percents.length === 0) {
    const min = Math.min(...fixedAmounts);
    const max = Math.max(...fixedAmounts);
    return min === max ? fmtCurrency(min) : `${fmtCurrency(min)}–${fmtCurrency(max)}`;
  }
  return t('listings.detail.groupMarginMixed', { count: ranges.length });
};

export const ListingDetailPageContainer: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isTitleDrawerOpen, setIsTitleDrawerOpen] = useState(false);
  const [isGroupDrawerOpen, setIsGroupDrawerOpen] = useState(false);
  const [isAutomationDrawerOpen, setIsAutomationDrawerOpen] = useState(false);
  const [isRevisionsDrawerOpen, setIsRevisionsDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<ListingOverridesUiState>(emptyOverrides);
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const {
    data: listing,
    isLoading,
    isError,
  } = useGetListingByIdQuery(listingId ?? '', {
    skip: !listingId,
    refetchOnMountOrArgChange: true,
  });
  const { data: revisionsPreview } = useGetListingRevisionsQuery(
    { listingId: listingId ?? '', query: { page: 1, limit: 1 } },
    { skip: !listingId }
  );

  const { data: listingSettingsGroups = [] } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [] } = useGetBusinessPoliciesQuery();

  const [updateListing, { isLoading: isSaving }] = useUpdateListingMutation();
  const [endListings, { isLoading: isEnding }] = useEndListingsMutation();
  const [deleteListings, { isLoading: isDeleting }] = useDeleteListingsMutation();
  const [publishListing, { isLoading: isPublishing }] = usePublishListingMutation();

  useLoading(isSaving || isSavingOverrides || isSavingGroup || isEnding || isDeleting || isPublishing);

  const form = useForm<UpdateListingFormData>({
    resolver: zodResolver(updateListingSchema(t)) as never,
    mode: 'onSubmit',
    defaultValues: {
      title: '',
      listingSettingsGroupId: '',
    },
  });

  const { reset, getValues, handleSubmit: rhfSubmit } = form;

  /** Discards any unsaved title/group edits — used on drawer open (fresh from
   *  server) and on drawer close-without-save (so an edit in one drawer can
   *  never leak into the other's save, since both share this form). */
  const resetFormFromListing = useCallback(() => {
    if (!listing) {
      return;
    }
    reset({
      title: listing.title ?? '',
      listingSettingsGroupId: listing.listingSettingsGroupId ?? '',
    });
  }, [listing, reset]);

  useEffect(() => {
    if (!listing) {
      return;
    }
    resetFormFromListing();
    // Hydrate local automation UI from server listing payload
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local draft from remote listing
    setOverrides({
      pauseSales: Boolean(listing.disableOrdering),
      fixedPrice: Boolean(listing.lockPrice || listing.disableRepricing),
      fixedQuantity: Boolean(listing.lockQuantity),
      priceOverride:
        listing.priceOverride !== null && listing.priceOverride !== undefined ? String(listing.priceOverride) : '',
      quantityOverride:
        listing.quantityOverride !== null && listing.quantityOverride !== undefined
          ? String(listing.quantityOverride)
          : '',
      marginPercentOverride:
        listing.marginPercentOverride !== null && listing.marginPercentOverride !== undefined
          ? String(listing.marginPercentOverride)
          : '',
      marginFixedOverride:
        listing.marginFixedOverride !== null && listing.marginFixedOverride !== undefined
          ? String(listing.marginFixedOverride)
          : '',
    });
    setSelectedImageIndex(0);
    setDescriptionExpanded(false);
  }, [listing, resetFormFromListing]);

  useEffect(() => {
    if (!isError) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: 'listings:listings.detail.loadFailed',
      },
      t
    );
  }, [isError, showMessage, t]);

  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const fmtCurrency = useCallback(
    (value: number) => formatCurrency(value, localeCfg.locale, listing?.currency ?? 'USD'),
    [listing?.currency, localeCfg.locale]
  );

  const fmtDate = useCallback(
    (dateString: string) =>
      formatDate(dateString, localeCfg.locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    [localeCfg]
  );

  /** Same date, plus the clock time — for record timestamps, where "when today"
   *  is the whole point and a bare date reads as stale. */
  const fmtDateTime = useCallback(
    (dateString: string) =>
      formatDate(dateString, localeCfg.locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [localeCfg]
  );

  const businessPolicies = useMemo(
    () => ({
      payment: policiesMap.filter((p) => p.type === PolicyType.PAYMENT),
      shipping: policiesMap.filter((p) => p.type === PolicyType.SHIPPING),
      return: policiesMap.filter((p) => p.type === PolicyType.RETURN),
    }),
    [policiesMap]
  );

  const dash = t('listings.detail.notSet');

  const strategyGroupLabel = useMemo(
    () =>
      listing?.listingSettingsGroupName || resolveLabel(listingSettingsGroups, listing?.listingSettingsGroupId, dash),
    [listing, listingSettingsGroups, dash]
  );

  const paymentPolicyLabel = useMemo(
    () => resolveLabel(businessPolicies.payment, listing?.paymentPolicyId, dash),
    [businessPolicies.payment, listing?.paymentPolicyId, dash]
  );
  const shippingPolicyLabel = useMemo(
    () => resolveLabel(businessPolicies.shipping, listing?.shippingPolicyId, dash),
    [businessPolicies.shipping, listing?.shippingPolicyId, dash]
  );
  const returnPolicyLabel = useMemo(
    () => resolveLabel(businessPolicies.return, listing?.returnPolicyId, dash),
    [businessPolicies.return, listing?.returnPolicyId, dash]
  );

  /** Always exactly 4 rows, so the Otomasyon Durumu card can reuse Performance's
   *  fixed-4-item 2-column MetaList styling verbatim — a variable-length list
   *  would need parity-aware border logic instead of the simple nth-of-type
   *  rule that assumes exactly 4 items. Custom margin reports "na" (not the
   *   3rd state's absence) while fixed price is on, so the row explains itself
   *  instead of just vanishing. */
  const automationStatusItems = useMemo<AutomationStatusItem[]>(() => {
    const marginPercent = parseOptionalNumber(overrides.marginPercentOverride);
    const marginFixed = parseOptionalNumber(overrides.marginFixedOverride);
    const hasCustomMargin = marginPercent !== null || marginFixed !== null;

    return [
      {
        key: 'pauseSales',
        icon: 'block',
        label: t('listings.detail.pauseSales'),
        state: overrides.pauseSales ? 'on' : 'off',
        detail: overrides.pauseSales ? t('listings.detail.pauseSalesActiveDetail') : undefined,
      },
      {
        key: 'fixedPrice',
        icon: 'lock',
        label: t('listings.detail.fixedPrice'),
        state: overrides.fixedPrice ? 'on' : 'off',
        detail: overrides.fixedPrice
          ? fmtCurrency(parseOptionalNumber(overrides.priceOverride) ?? listing?.price ?? 0)
          : undefined,
      },
      {
        key: 'fixedQuantity',
        icon: 'box',
        label: t('listings.detail.fixedQuantity'),
        state: overrides.fixedQuantity ? 'on' : 'off',
        detail: overrides.fixedQuantity
          ? t('listings.detail.fixedQuantityDetail', {
              count: parseOptionalNumber(overrides.quantityOverride) ?? listing?.quantity ?? 0,
            })
          : undefined,
      },
      overrides.fixedPrice
        ? {
            key: 'customMargin',
            icon: 'badge-percent',
            label: t('listings.detail.customMarginShort'),
            state: 'na',
            detail: t('listings.detail.customMarginNaDetail'),
          }
        : {
            key: 'customMargin',
            icon: 'badge-percent',
            label: t('listings.detail.customMarginShort'),
            state: hasCustomMargin ? 'on' : 'off',
            detail: hasCustomMargin
              ? marginPercent !== null
                ? t('listings.detail.customMarginPercentDetail', { percent: marginPercent })
                : fmtCurrency(marginFixed ?? 0)
              : undefined,
          },
    ];
  }, [overrides, listing?.price, listing?.quantity, fmtCurrency, t]);

  /** The listing's own resolved group object (full domain shape, not just the
   *  {id,name} pair `strategyGroupLabel` uses) — backs the Listeleme Ayar
   *  Grubu card's fact rows. */
  const selectedGroup = useMemo(
    () => listingSettingsGroups.find((g) => g.id === listing?.listingSettingsGroupId),
    [listingSettingsGroups, listing?.listingSettingsGroupId]
  );

  const groupDefaultQuantityLabel = useMemo(() => {
    const qty = selectedGroup?.stock?.defaultQuantity;
    return typeof qty === 'number' ? String(qty) : dash;
  }, [selectedGroup, dash]);

  const groupStockBufferLabel = useMemo(() => {
    const buffer = selectedGroup?.stock?.stockBuffer;
    return typeof buffer === 'number' ? String(buffer) : dash;
  }, [selectedGroup, dash]);

  const groupMarginSummaryLabel = useMemo(
    () => summarizeMarginStrategy(selectedGroup?.repricingStrategy, fmtCurrency, t) ?? dash,
    [selectedGroup, fmtCurrency, t, dash]
  );

  /** Per-range breakdown backing the Kâr Marjı info tooltip — only meaningful
   *  once there's more than one range to distinguish; a single range already
   *  says everything in `groupMarginSummaryLabel` itself. */
  const groupMarginRangeDetails = useMemo(() => {
    const ranges = selectedGroup?.repricingStrategy;
    if (!ranges || ranges.length <= 1) {
      return [];
    }
    return ranges.map((range) => {
      const bounds = `${fmtCurrency(range.minPrice)} – ${fmtCurrency(range.maxPrice)}`;
      const value =
        typeof range.profitMarginPercent === 'number'
          ? `%${range.profitMarginPercent}`
          : typeof range.fixedProfitAmount === 'number'
            ? fmtCurrency(range.fixedProfitAmount)
            : dash;
      return t('listings.detail.groupMarginRow', { range: bounds, value });
    });
  }, [selectedGroup, fmtCurrency, t, dash]);

  const statusLabel = useMemo(() => {
    if (!listing) {
      return '';
    }
    const key = `listings.status.${listing.status}` as const;
    const translated = t(key);
    return translated === key ? listing.status : translated;
  }, [listing, t]);

  const handleBack = () => {
    localeNavigate('/listings/all');
  };

  const handleOpenTitleDrawer = () => {
    resetFormFromListing();
    setIsTitleDrawerOpen(true);
  };

  const handleCloseTitleDrawer = () => {
    resetFormFromListing();
    setIsTitleDrawerOpen(false);
  };

  const handleOpenGroupDrawer = () => {
    resetFormFromListing();
    setIsGroupDrawerOpen(true);
  };

  const handleCloseGroupDrawer = () => {
    resetFormFromListing();
    setIsGroupDrawerOpen(false);
  };

  const handleOpenAutomationDrawer = () => {
    resetFormFromListing();
    setIsAutomationDrawerOpen(true);
  };

  const handleCloseAutomationDrawer = () => {
    resetFormFromListing();
    setIsAutomationDrawerOpen(false);
  };

  const handleOpenRevisions = () => {
    setIsRevisionsDrawerOpen(true);
  };

  const handleCloseRevisions = () => {
    setIsRevisionsDrawerOpen(false);
  };

  const handleSave = () => {
    if (!listingId) {
      return;
    }
    void rhfSubmit(async (data) => {
      try {
        await updateListing({ id: listingId, data: { title: data.title } }).unwrap();
        setIsTitleDrawerOpen(false);
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'listings:listings.detail.saveSuccess',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      } catch {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'listings:listings.detail.saveFailed',
          },
          t
        );
      }
    })();
  };

  /** Group swap now lives entirely in its own drawer (`handleSaveGroup`) — this
   *  only ever sends the override columns, so a stale/unsaved group pick made
   *  while this drawer happens to be open can never leak into the request. */
  const handleSaveOverrides = () => {
    if (!listingId) {
      return;
    }
    setIsSavingOverrides(true);
    // Map simplified UI → DB columns (fixed price drives lockPrice + disableRepricing)
    void updateListing({
      id: listingId,
      data: {
        disableOrdering: overrides.pauseSales,
        disableRepricing: overrides.fixedPrice,
        lockPrice: overrides.fixedPrice,
        lockQuantity: overrides.fixedQuantity,
        priceOverride: overrides.fixedPrice ? parseOptionalNumber(overrides.priceOverride) : null,
        quantityOverride: overrides.fixedQuantity ? parseOptionalNumber(overrides.quantityOverride) : null,
        marginPercentOverride: overrides.fixedPrice ? null : parseOptionalNumber(overrides.marginPercentOverride),
        marginFixedOverride: overrides.fixedPrice ? null : parseOptionalNumber(overrides.marginFixedOverride),
      },
    })
      .unwrap()
      .then(() => {
        setIsAutomationDrawerOpen(false);
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'listings:listings.detail.saveSuccess',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      })
      .catch(() => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'listings:listings.detail.saveFailed',
          },
          t
        );
      })
      .finally(() => setIsSavingOverrides(false));
  };

  const handleSaveGroup = () => {
    if (!listingId) {
      return;
    }
    setIsSavingGroup(true);
    const groupId = getValues('listingSettingsGroupId');
    void updateListing({
      id: listingId,
      data: { listingSettingsGroupId: groupId || undefined },
    })
      .unwrap()
      .then(() => {
        setIsGroupDrawerOpen(false);
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'listings:listings.detail.saveSuccess',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      })
      .catch(() => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'listings:listings.detail.saveFailed',
          },
          t
        );
      })
      .finally(() => setIsSavingGroup(false));
  };

  const handleEnd = () => {
    if (!listingId) {
      return;
    }
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.endTitle',
        descriptionKey: 'listings:listings.modals.endDescription',
        descriptionParams: { count: 1 },
        primaryButton: {
          labelKey: 'listings:listings.actions.endListing',
          onClick: () => {
            closeMessage();
            void endListings([listingId])
              .unwrap()
              .then(() => {
                showMessage(
                  {
                    type: 'success',
                    headerKey: 'listings:listings.notifications.endSuccessTitle',
                    descriptionKey: 'listings:listings.notifications.endSuccess',
                    descriptionParams: { count: 1 },
                    primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
                  },
                  t
                );
              })
              .catch(() => {
                showMessage(
                  {
                    type: 'error',
                    headerKey: 'listings:listings.notifications.endErrorTitle',
                    descriptionKey: 'listings:listings.notifications.endError',
                  },
                  t
                );
              });
          },
        },
        secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
      },
      t
    );
  };

  const handleDelete = () => {
    if (!listingId) {
      return;
    }
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.deleteTitle',
        descriptionKey: 'listings:listings.modals.deleteDescription',
        descriptionParams: { count: 1 },
        primaryButton: {
          labelKey: 'listings:listings.actions.deleteListings',
          onClick: () => {
            closeMessage();
            void deleteListings([listingId])
              .unwrap()
              .then(() => {
                showMessage(
                  {
                    type: 'success',
                    headerKey: 'listings:listings.notifications.deleteSuccessTitle',
                    descriptionKey: 'listings:listings.notifications.deleteSuccess',
                    descriptionParams: { count: 1 },
                    primaryButton: {
                      labelKey: 'translation:common.ok',
                      onClick: () => {
                        closeMessage();
                        localeNavigate('/listings/all');
                      },
                    },
                  },
                  t
                );
              })
              .catch(() => {
                showMessage(
                  {
                    type: 'error',
                    headerKey: 'listings:listings.notifications.deleteErrorTitle',
                    descriptionKey: 'listings:listings.notifications.deleteError',
                  },
                  t
                );
              });
          },
        },
        secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
      },
      t
    );
  };

  const handlePublish = () => {
    if (!listingId) {
      return;
    }
    showMessage(
      {
        type: 'info',
        headerKey: 'listings:listings.modals.publishOneTitle',
        descriptionKey: 'listings:listings.modals.publishOneDescription',
        primaryButton: {
          labelKey: 'listings:listings.actions.publish',
          onClick: () => {
            closeMessage();
            void publishListing(listingId)
              .unwrap()
              .then(() => {
                showMessage(
                  {
                    type: 'success',
                    headerKey: 'listings:listings.notifications.publishSuccessTitle',
                    descriptionKey: 'listings:listings.notifications.publishSuccess',
                    descriptionParams: { count: 1 },
                    primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
                  },
                  t
                );
              })
              .catch(() => {
                showMessage(
                  {
                    type: 'error',
                    headerKey: 'listings:listings.notifications.publishErrorTitle',
                    descriptionKey: 'listings:listings.notifications.publishError',
                  },
                  t
                );
              });
          },
        },
        secondaryButton: { labelKey: 'translation:common.cancel', onClick: closeMessage },
      },
      t
    );
  };

  /** Mobile manage sheet: edit / publish / end / delete without header button clutter */
  const handleManage = () => {
    if (listing?.status === ListingStatus.DRAFT) {
      showMessage(
        {
          type: 'info',
          headerKey: 'listings:listings.detail.manage',
          descriptionKey: 'listings:listings.detail.publishHint',
          primaryButton: {
            labelKey: 'listings:listings.detail.publish',
            onClick: () => {
              closeMessage();
              handlePublish();
            },
          },
          secondaryButton: {
            labelKey: 'listings:listings.detail.deleteShort',
            onClick: () => {
              closeMessage();
              handleDelete();
            },
          },
        },
        t
      );
      return;
    }

    showMessage(
      {
        type: 'info',
        headerKey: 'listings:listings.detail.manage',
        descriptionKey: 'listings:listings.detail.automationDrawerSubtitle',
        primaryButton: {
          labelKey: 'listings:listings.detail.editConfig',
          onClick: () => {
            closeMessage();
            handleOpenAutomationDrawer();
          },
        },
        secondaryButton:
          listing?.status === ListingStatus.ACTIVE
            ? {
                labelKey: 'listings:listings.detail.endShort',
                onClick: () => {
                  closeMessage();
                  handleEnd();
                },
              }
            : {
                labelKey: 'listings:listings.detail.deleteShort',
                onClick: () => {
                  closeMessage();
                  handleDelete();
                },
              },
      },
      t
    );
  };

  return (
    <ListingDetailPageComponent
      listing={listing}
      isLoading={isLoading}
      isSaving={isSaving}
      isSavingOverrides={isSavingOverrides}
      isActionLoading={isEnding || isDeleting || isPublishing}
      form={form}
      listingSettingsGroups={listingSettingsGroups}
      strategyGroupLabel={strategyGroupLabel}
      groupDefaultQuantityLabel={groupDefaultQuantityLabel}
      groupStockBufferLabel={groupStockBufferLabel}
      groupMarginSummaryLabel={groupMarginSummaryLabel}
      groupMarginRangeDetails={groupMarginRangeDetails}
      paymentPolicyLabel={paymentPolicyLabel}
      shippingPolicyLabel={shippingPolicyLabel}
      returnPolicyLabel={returnPolicyLabel}
      selectedImageIndex={selectedImageIndex}
      onSelectImage={setSelectedImageIndex}
      descriptionExpanded={descriptionExpanded}
      onToggleDescription={() => setDescriptionExpanded((v) => !v)}
      isTitleDrawerOpen={isTitleDrawerOpen}
      onOpenTitleDrawer={handleOpenTitleDrawer}
      onCloseTitleDrawer={handleCloseTitleDrawer}
      isGroupDrawerOpen={isGroupDrawerOpen}
      onOpenGroupDrawer={handleOpenGroupDrawer}
      onCloseGroupDrawer={handleCloseGroupDrawer}
      onSaveGroup={handleSaveGroup}
      isSavingGroup={isSavingGroup}
      isAutomationDrawerOpen={isAutomationDrawerOpen}
      onOpenAutomationDrawer={handleOpenAutomationDrawer}
      onCloseAutomationDrawer={handleCloseAutomationDrawer}
      overrides={overrides}
      onOverrideChange={(patch) => setOverrides((prev) => ({ ...prev, ...patch }))}
      onSaveOverrides={handleSaveOverrides}
      automationStatusItems={automationStatusItems}
      formatCurrency={fmtCurrency}
      formatDate={fmtDate}
      formatDateTime={fmtDateTime}
      onBack={handleBack}
      onSave={handleSave}
      onEnd={handleEnd}
      onDelete={handleDelete}
      onPublish={handlePublish}
      onManage={handleManage}
      isRevisionsDrawerOpen={isRevisionsDrawerOpen}
      hasRevisions={(revisionsPreview?.total ?? 0) > 0}
      onOpenRevisions={handleOpenRevisions}
      onCloseRevisions={handleCloseRevisions}
      canEnd={listing?.status === ListingStatus.ACTIVE}
      canDelete={Boolean(listing)}
      canPublish={listing?.status === ListingStatus.DRAFT}
      statusLabel={statusLabel}
      statusTone={listing?.status ?? ListingStatus.INACTIVE}
    />
  );
};

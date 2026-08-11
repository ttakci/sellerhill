import { zodResolver } from '@hookform/resolvers/zod';
import { ListingStatus, PolicyType, updateListingSchema, type UpdateListingFormData } from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
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
import type { ListingOverridesUiState } from './ListingDetailPage.types';

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

export const ListingDetailPageContainer: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isTitleDrawerOpen, setIsTitleDrawerOpen] = useState(false);
  const [isAutomationDrawerOpen, setIsAutomationDrawerOpen] = useState(false);
  const [isRevisionsDrawerOpen, setIsRevisionsDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<ListingOverridesUiState>(emptyOverrides);
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);

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

  useLoading(isSaving || isSavingOverrides || isEnding || isDeleting || isPublishing);

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

  /** Compact "what's active" line for the Automation card's summary row. */
  const automationSummary = useMemo(() => {
    const active: string[] = [];
    if (overrides.pauseSales) {
      active.push(t('listings.detail.pauseSales'));
    }
    if (overrides.fixedPrice) {
      active.push(t('listings.detail.fixedPrice'));
    }
    if (overrides.fixedQuantity) {
      active.push(t('listings.detail.fixedQuantity'));
    }
    return active.length > 0 ? active.join(', ') : t('listings.detail.automationNone');
  }, [overrides, t]);

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

  const handleSaveOverrides = () => {
    if (!listingId) {
      return;
    }
    setIsSavingOverrides(true);
    const groupId = getValues('listingSettingsGroupId');
    // Map simplified UI → DB columns (fixed price drives lockPrice + disableRepricing)
    void updateListing({
      id: listingId,
      data: {
        listingSettingsGroupId: groupId || undefined,
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
      isAutomationDrawerOpen={isAutomationDrawerOpen}
      onOpenAutomationDrawer={handleOpenAutomationDrawer}
      onCloseAutomationDrawer={handleCloseAutomationDrawer}
      overrides={overrides}
      onOverrideChange={(patch) => setOverrides((prev) => ({ ...prev, ...patch }))}
      onSaveOverrides={handleSaveOverrides}
      automationSummary={automationSummary}
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

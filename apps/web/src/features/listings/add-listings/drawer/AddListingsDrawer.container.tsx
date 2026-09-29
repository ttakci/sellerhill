import { zodResolver } from '@hookform/resolvers/zod';
import {
  ListingJobQueuedSummary,
  PolicyType,
  createListingsSchema,
  isValidAsinShape,
  parseAsins,
  resolveListingJobQueuedSummary,
  type CreateListingsFormData,
  type CreateListingsRequest,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCreateListingsMutation, useGetBusinessPoliciesQuery } from '../../api/listings.api';

import { AddListingsDrawerComponent } from './AddListingsDrawer.component';
import type {
  AddListingsDrawerPreferences,
  AddListingsDrawerProps,
  AddListingsDrawerStep,
} from './AddListingsDrawer.types';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

const PREFERENCES_STORAGE_KEY = 'sellerhill:add-listings-preferences:v1';

const EMPTY_PREFERENCES: AddListingsDrawerPreferences = {
  ebayAccountId: '',
  listingSettingsGroupId: '',
  paymentPolicyId: '',
  shippingPolicyId: '',
  returnPolicyId: '',
  asDraft: false,
};

const readPreferences = (): AddListingsDrawerPreferences => {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) {
      return EMPTY_PREFERENCES;
    }

    const parsed = JSON.parse(stored) as Partial<AddListingsDrawerPreferences>;
    return {
      ebayAccountId: typeof parsed.ebayAccountId === 'string' ? parsed.ebayAccountId : '',
      listingSettingsGroupId: typeof parsed.listingSettingsGroupId === 'string' ? parsed.listingSettingsGroupId : '',
      paymentPolicyId: typeof parsed.paymentPolicyId === 'string' ? parsed.paymentPolicyId : '',
      shippingPolicyId: typeof parsed.shippingPolicyId === 'string' ? parsed.shippingPolicyId : '',
      returnPolicyId: typeof parsed.returnPolicyId === 'string' ? parsed.returnPolicyId : '',
      asDraft: parsed.asDraft === true,
    };
  } catch {
    return EMPTY_PREFERENCES;
  }
};

const writePreferences = (preferences: AddListingsDrawerPreferences) => {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in privacy mode; the drawer must remain usable.
  }
};

/**
 * The schema refuses a batch above 1000 ASINs (`createListingsSchema`), so a
 * pre-filled list is trimmed to what can actually be submitted rather than
 * arriving already invalid. Same cap as the schema — keep the two in step.
 */
const MAX_PREFILLED_ASINS = 1000;

const normalizePrefilledAsins = (raw: string | undefined): string =>
  raw ? parseAsins(raw).slice(0, MAX_PREFILLED_ASINS).join('\n') : '';

/**
 * Fresh form values for an open: the stored store/group/policy preferences plus
 * whatever ASINs were handed in. Used both for `defaultValues` (a drawer that
 * MOUNTS open, e.g. `/listings?drawer=add`) and for the reset on a later open
 * — the two used to differ, see the note at the open transition below.
 */
const buildOpenValues = (initialAsins: string | undefined): CreateListingsFormData => ({
  asins: normalizePrefilledAsins(initialAsins),
  ...readPreferences(),
});

/**
 * i18n key for the post-submit success toast. The draft/live split only
 * matters when something was actually queued — an all-duplicates submission
 * reads the same either way, since nothing happened.
 */
const resolveQueuedMessageKey = (summary: ListingJobQueuedSummary, asDraft: boolean): string => {
  switch (summary) {
    case ListingJobQueuedSummary.ALL_SKIPPED_DUPLICATES:
      return 'listings:listings.success.allSkippedDuplicates';
    case ListingJobQueuedSummary.QUEUED_WITH_SKIPPED_DUPLICATES:
      return asDraft
        ? 'listings:listings.success.queuedDraftWithSkipped'
        : 'listings:listings.success.queuedWithSkipped';
    case ListingJobQueuedSummary.ALL_QUEUED:
    default:
      return asDraft ? 'listings:listings.success.queuedDraft' : 'listings:listings.success.queued';
  }
};

export const AddListingsDrawer: React.FC<AddListingsDrawerProps> = ({ isOpen, onClose, onSuccess, initialAsins }) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const [currentStep, setCurrentStep] = useState<AddListingsDrawerStep>(0);
  const lastSubmittedAsDraft = useRef(false);

  const { data: ebayAccountsData, isLoading: isLoadingAccounts } = useGetEbayAccountsQuery();
  const ebayAccounts = useMemo(
    () =>
      (ebayAccountsData?.items ?? []).map((account) => ({
        id: account.id,
        name: account.storeName || account.ebayUsername || account.sellerId || account.id,
      })),
    [ebayAccountsData?.items]
  );
  const { data: listingSettingsGroups = [], isLoading: isLoadingSettings } = useGetListingSettingsGroupsQuery();
  const { data: policiesMap = [], isLoading: isLoadingPolicies } = useGetBusinessPoliciesQuery();

  const [
    createListings,
    { isLoading: isSubmitting, isSuccess, error: submitError, data: submitData, reset: resetMutation },
  ] = useCreateListingsMutation();

  const isLoading = isLoadingAccounts || isLoadingSettings || isLoadingPolicies;
  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isSubmitting);

  const form = useForm<CreateListingsFormData>({
    resolver: zodResolver(createListingsSchema(t)) as never,
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    /*
     * A drawer that mounts already open (deep link) never goes through the
     * open transition below, so its defaults have to be the real opening
     * values. They used to be blanks: the stored preferences were never
     * loaded, and the preferences effect then wrote those blanks BACK over
     * the saved selections — a seller who followed `/listings?drawer=add`
     * lost their remembered store/group/policies.
     */
    defaultValues: isOpen ? buildOpenValues(initialAsins) : { ...EMPTY_PREFERENCES, asins: '' },
  });

  const { reset, control, handleSubmit: rhfSubmit, clearErrors } = form;

  // Reset step + form when the drawer opens (the initial mount is covered by
  // `defaultValues` above, which is built from the same values).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialAsins, setPrevInitialAsins] = useState(initialAsins);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setPrevInitialAsins(initialAsins);
    if (isOpen) {
      setCurrentStep(0);
      clearErrors();
      reset(buildOpenValues(initialAsins));
    }
  } else if (isOpen && initialAsins !== prevInitialAsins) {
    // A new hand-off while already open (another Best Sellers pick): only the
    // ASINs change; the seller's step and store/group/policy choices stay.
    setPrevInitialAsins(initialAsins);
    form.setValue('asins', normalizePrefilledAsins(initialAsins), { shouldValidate: false, shouldDirty: true });
  }

  React.useEffect(() => {
    if (isSuccess && submitData) {
      const wasDraft = lastSubmittedAsDraft.current;
      const skipped = submitData.skippedDuplicateCount ?? 0;
      const summary = resolveListingJobQueuedSummary(submitData.totalAsins, skipped);
      resetMutation();
      onClose();
      showMessage(
        {
          type: 'info',
          headerKey: 'translation:message.success.header',
          descriptionKey: resolveQueuedMessageKey(summary, wasDraft),
          descriptionParams: { count: submitData.totalAsins, skipped },
          primaryButton: {
            labelKey: 'translation:message.success.ok',
            onClick: () => {
              closeMessage();
              onSuccess({ asDraft: wasDraft });
            },
          },
        },
        t
      );
    }
  }, [isSuccess, submitData, showMessage, closeMessage, t, onClose, onSuccess, resetMutation]);

  React.useEffect(() => {
    if (submitError) {
      // The API answers with an i18n KEY (`billing.errors.listingQuotaExhausted`),
      // not a sentence. Handing it over raw made the dialog print the key itself,
      // because it carries no namespace and resolved against `translation`.
      const errorMsg = getErrorI18nKey(
        submitError as Parameters<typeof getErrorI18nKey>[0],
        'listings:listings.errors.createFailed'
      );
      resetMutation();
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: errorMsg,
          primaryButton: {
            labelKey: 'translation:message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [submitError, showMessage, closeMessage, t, resetMutation]);

  const businessPolicies = useMemo(
    () => ({
      payment: policiesMap.filter((p) => p.type === PolicyType.PAYMENT),
      shipping: policiesMap.filter((p) => p.type === PolicyType.SHIPPING),
      return: policiesMap.filter((p) => p.type === PolicyType.RETURN),
    }),
    [policiesMap]
  );

  const watchedAsins = useWatch({ control, name: 'asins' });
  const asinCount = useMemo(() => {
    if (!watchedAsins?.trim()) {
      return 0;
    }
    return parseAsins(watchedAsins).length;
  }, [watchedAsins]);

  const handleAsinChange = (value: string) => {
    form.setValue('asins', value, { shouldValidate: false, shouldDirty: true });
  };

  // Soft gate per step — no red field errors until final submit
  const watchedValues = useWatch({ control });

  React.useEffect(() => {
    if (!isOpen || isLoading) {
      return;
    }

    const hasId = (items: Array<{ id: string }>, id: string | undefined) =>
      Boolean(id && items.some((item) => item.id === id));
    const preferences: AddListingsDrawerPreferences = {
      ebayAccountId: hasId(ebayAccounts, watchedValues.ebayAccountId) ? watchedValues.ebayAccountId ?? '' : '',
      listingSettingsGroupId: hasId(listingSettingsGroups, watchedValues.listingSettingsGroupId)
        ? watchedValues.listingSettingsGroupId ?? ''
        : '',
      paymentPolicyId: hasId(businessPolicies.payment, watchedValues.paymentPolicyId)
        ? watchedValues.paymentPolicyId ?? ''
        : '',
      shippingPolicyId: hasId(businessPolicies.shipping, watchedValues.shippingPolicyId)
        ? watchedValues.shippingPolicyId ?? ''
        : '',
      returnPolicyId: hasId(businessPolicies.return, watchedValues.returnPolicyId)
        ? watchedValues.returnPolicyId ?? ''
        : '',
      asDraft: Boolean(watchedValues.asDraft),
    };

    for (const key of [
      'ebayAccountId',
      'listingSettingsGroupId',
      'paymentPolicyId',
      'shippingPolicyId',
      'returnPolicyId',
    ] as const) {
      if (watchedValues[key] !== preferences[key]) {
        form.setValue(key, preferences[key]);
      }
    }
    writePreferences(preferences);
  }, [isOpen, isLoading, ebayAccounts, listingSettingsGroups, businessPolicies, watchedValues, form]);

  const canProceed = useMemo(() => {
    if (currentStep === 0) {
      return Boolean(
        watchedValues.ebayAccountId &&
          watchedValues.listingSettingsGroupId &&
          watchedValues.paymentPolicyId &&
          watchedValues.shippingPolicyId &&
          watchedValues.returnPolicyId
      );
    }
    return asinCount > 0;
  }, [currentStep, watchedValues, asinCount]);

  const handleNext = () => {
    if (currentStep < 1 && canProceed) {
      setCurrentStep(1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(0);
    } else {
      onClose();
    }
  };

  const submitAsins = (data: CreateListingsFormData, validAsins: string[]) => {
    lastSubmittedAsDraft.current = Boolean(data.asDraft);
    const cleanData: CreateListingsRequest = {
      asins: validAsins,
      ebayAccountId: data.ebayAccountId,
      listingSettingsGroupId: data.listingSettingsGroupId,
      paymentPolicyId: data.paymentPolicyId,
      shippingPolicyId: data.shippingPolicyId,
      returnPolicyId: data.returnPolicyId,
      asDraft: Boolean(data.asDraft),
    };
    void createListings(cleanData);
  };

  const handleSubmit = () => {
    void rhfSubmit((data: CreateListingsFormData) => {
      const parsed = parseAsins(data.asins);
      const validAsins = parsed.filter((asin) => isValidAsinShape(asin));
      const skippedCount = parsed.length - validAsins.length;

      // Malformed entries never block the rest of the batch — they're filtered
      // out here (the schema only blocks submission when NOTHING is usable) and
      // the seller is warned before the well-formed ones are searched.
      if (skippedCount > 0) {
        showMessage(
          {
            type: 'warning',
            headerKey: 'translation:message.warning.header',
            descriptionKey: 'listings:listings.errors.invalidAsins',
            descriptionParams: { count: skippedCount },
            primaryButton: {
              labelKey: 'translation:common.continue',
              onClick: () => {
                closeMessage();
                submitAsins(data, validAsins);
              },
            },
            secondaryButton: {
              labelKey: 'translation:common.cancel',
              onClick: closeMessage,
            },
          },
          t
        );
        return;
      }

      submitAsins(data, validAsins);
    })();
  };

  return (
    <AddListingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      currentStep={currentStep}
      isSubmitting={isSubmitting}
      isLoading={isLoading}
      form={form}
      ebayAccounts={ebayAccounts}
      listingSettingsGroups={listingSettingsGroups}
      businessPolicies={businessPolicies}
      asinCount={asinCount}
      onAsinChange={handleAsinChange}
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      canProceed={canProceed}
    />
  );
};

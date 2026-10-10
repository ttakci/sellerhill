import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_LISTING_RULES,
  DEFAULT_PRICE_ENDING_CENTS,
  COLD_LISTING_MIN_DAYS,
  LISTING_CLEANUP_MAX_DAYS,
  TemplateType,
  applyPriceEnding,
  buildListingTemplateSnippet,
  listingSettingsGroupSchema,
  renderListingTemplate,
  type ListingSettingsGroupFormData,
  type ListingTemplatePlaceholder,
  type PredefinedTemplateResponse,
} from '@repo/shared';
import { formatCurrency, useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { ListingGroupDrawerComponent } from './ListingGroupDrawer.component';
import {
  ColdListingMode,
  ListingRulesDraftError,
  type ListingGroupDrawerProps,
  type ListingGroupDrawerStep,
  type ListingRulesDraft,
} from './ListingGroupDrawer.types';
import { fromListingRulesDraft, listingRulesDraftError, toListingRulesDraft } from './listingRulesForm';

import {
  useCreateListingSettingsGroupMutation,
  useGetListingSettingsGroupByIdQuery,
  useGetPredefinedTemplatesQuery,
  useUpdateListingSettingsGroupMutation,
} from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { predefinedTemplateName } from '@/features/settings/utils/predefinedTemplateLabel';

/**
 * Sentinel for the "Custom" row of the Active Template select. Custom is a
 * `templates.type`, not a template id, so it needs a value the id space cannot
 * collide with. It stays in the container: the select's options, its value and
 * its change handler are all resolved here, so the component never has to know
 * this exists.
 */
const CUSTOM_TEMPLATE_OPTION = '__custom__';

const STEP_FIELDS: Partial<Record<number, FieldPath<ListingSettingsGroupFormData>[]>> = {
  0: ['name', 'stock.defaultQuantity', 'stock.stockBuffer'],
  1: ['fees.ebayFeePercent', 'fees.fixedFeeAmount'],
  2: ['repricingStrategy', 'fees.priceRoundingEnabled', 'fees.priceEndingCents'],
};

/** The step that holds the listing rules, and the last one (the HTML template). */
const RULES_STEP = 3;
const LAST_STEP = 4;

const OUT_OF_STOCK_CHOICES = ['3', '7', '14', '30', '60'];

/** An ordinary computed price used to show what the chosen ending does to it. */
const PRICE_ROUNDING_SAMPLE = 27.31;

export const ListingGroupDrawer: React.FC<ListingGroupDrawerProps> = ({ isOpen, onClose, editingGroupId }) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const isEdit = !!editingGroupId;

  const [currentStep, setCurrentStep] = useState<ListingGroupDrawerStep>(0);

  const { data: group, isLoading: isGroupLoading } = useGetListingSettingsGroupByIdQuery(editingGroupId!, {
    skip: !isEdit || !isOpen,
  });
  const { data: templates = [], isLoading: isTemplatesLoading } = useGetPredefinedTemplatesQuery(undefined, {
    skip: !isOpen,
  });
  const [
    createListingSettingsGroup,
    { isLoading: isCreating, isSuccess: createSuccess, isError: createError, reset: resetCreate },
  ] = useCreateListingSettingsGroupMutation();
  const [
    updateListingSettingsGroup,
    { isLoading: isUpdating, isSuccess: updateSuccess, isError: updateError, reset: resetUpdate },
  ] = useUpdateListingSettingsGroupMutation();

  const isSaving = isCreating || isUpdating;
  const isLoading = isGroupLoading || isTemplatesLoading;
  const templateOptions = useMemo(
    () => [
      ...templates.map((template) => ({ value: template.id, label: predefinedTemplateName(t, template) })),
      { value: CUSTOM_TEMPLATE_OPTION, label: t('listingSettingsGroup.custom') },
    ],
    [t, templates]
  );
  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isSaving);

  // Form Initialization
  const form = useForm<ListingSettingsGroupFormData>({
    resolver: zodResolver(listingSettingsGroupSchema(t)) as any,
    // Only show field errors after explicit Next/Submit — never on drawer open
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: '',
      description: '',
      repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
      stock: { defaultQuantity: 1, stockBuffer: 0 },
      fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3 },
      templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: undefined },
      content: {
        stripBrandFromTitle: false,
        aiTitleEnabled: false,
        aiDescriptionEnabled: false,
      },
    },
  });

  const { reset, control, getValues, setValue, clearErrors, trigger, handleSubmit: rhfSubmit } = form;

  // Sync form with data when editing
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (group) {
      const strategies = group.repricingStrategy.map((s) => ({ ...s, id: s.id || crypto.randomUUID() }));
      reset({
        ...group,
        repricingStrategy: strategies,
        content: {
          stripBrandFromTitle: group.content?.stripBrandFromTitle ?? false,
          aiTitleEnabled: group.content?.aiTitleEnabled ?? false,
          aiDescriptionEnabled: group.content?.aiDescriptionEnabled ?? false,
        },
      });
    } else if (!isEdit) {
      // Reset to defaults for create mode
      reset({
        name: '',
        description: '',
        repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
        stock: { defaultQuantity: 1, stockBuffer: 0 },
        fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3 },
        templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: templates[0]?.id },
        content: {
          stripBrandFromTitle: false,
          aiTitleEnabled: false,
          aiDescriptionEnabled: false,
        },
      });
    }
  }, [group, templates, reset, isEdit, isOpen]);

  // Set default template when templates load in create mode
  useEffect(() => {
    if (!isEdit && templates.length > 0 && !getValues('templates.predefinedTemplateId')) {
      form.setValue('templates.predefinedTemplateId', templates[0].id);
    }
  }, [templates, isEdit, getValues, form]);

  // The Rules step keeps its own draft (text fields, validated on Continue).
  // It is re-seeded whenever the drawer opens or the edited group arrives —
  // a render-time adjustment, so an effect never overwrites what was typed.
  const [rulesDraft, setRulesDraft] = useState<ListingRulesDraft>(() => toListingRulesDraft(DEFAULT_LISTING_RULES));
  const [rulesAttempted, setRulesAttempted] = useState(false);
  const rulesKey = isOpen ? `${editingGroupId ?? 'new'}:${group ? String(group.updatedAt) : ''}` : 'closed';
  const [prevRulesKey, setPrevRulesKey] = useState(rulesKey);
  if (rulesKey !== prevRulesKey) {
    setPrevRulesKey(rulesKey);
    setRulesDraft(toListingRulesDraft((isEdit ? group?.listingRules : undefined) ?? DEFAULT_LISTING_RULES));
    setRulesAttempted(false);
  }
  const rulesError = listingRulesDraftError(rulesDraft);
  const rulesErrorText = (field: ListingRulesDraftError, text: string): string | undefined =>
    rulesAttempted && rulesError === field ? text : undefined;

  // Reset step when drawer opens (React-recommended render-time state adjustment)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCurrentStep(0);
    }
  }

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'repricingStrategy',
  });

  // Handle success
  useEffect(() => {
    if (createSuccess || updateSuccess) {
      resetCreate();
      resetUpdate();
      notifyDrawerDone({
        onClose,
        showMessage,
        closeMessage,
        t,
        descriptionKey: createSuccess
          ? 'listingSettingsGroup:listingSettingsGroup.success.created'
          : 'listingSettingsGroup:listingSettingsGroup.success.updated',
      });
    }
  }, [createSuccess, updateSuccess, showMessage, t, onClose, closeMessage, resetCreate, resetUpdate]);

  // Handle error
  useEffect(() => {
    if (createError || updateError) {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'listingSettingsGroup:listingSettingsGroup.errors.saveFailed',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t
      );
    }
  }, [createError, updateError, showMessage, t, closeMessage]);

  const handleAddRange = () => {
    const strategies = getValues('repricingStrategy');
    const lastStrategy = strategies?.length ? strategies[strategies.length - 1] : null;
    const lastMax = lastStrategy ? Number(lastStrategy.maxPrice) : 0;

    // Start one cent above where the previous range ends — no gap (currency
    // granularity is $0.01, so nothing falls between them) and no ambiguous
    // shared boundary (the schema now rejects minPrice === prev.maxPrice;
    // see listingSettingsGroup.schema.ts for why).
    append({
      id: crypto.randomUUID(),
      minPrice: Math.round((lastMax + 0.01) * 100) / 100,
      maxPrice: 9999,
      profitMarginPercent: 15,
    });
  };

  // Price ending ("charm pricing")
  const watchedFees = useWatch({ control, name: 'fees' });
  const isPriceRoundingEnabled = Boolean(watchedFees?.priceRoundingEnabled);
  const rawEnding = watchedFees?.priceEndingCents as unknown;
  const endingCents =
    rawEnding === undefined || rawEnding === null || String(rawEnding).trim() === '' ? NaN : Number(rawEnding);
  const isEndingValid = Number.isInteger(endingCents) && endingCents >= 0 && endingCents <= 99;
  const priceRoundingExample = isEndingValid
    ? t('listingSettingsGroup.priceRounding.example', {
        from: formatCurrency(PRICE_ROUNDING_SAMPLE, 'en-US', 'USD', 2),
        to: formatCurrency(applyPriceEnding(PRICE_ROUNDING_SAMPLE, endingCents), 'en-US', 'USD', 2),
      })
    : t('listingSettingsGroup.priceRounding.hint');

  const handlePriceRoundingToggle = (enabled: boolean) => {
    setValue('fees.priceRoundingEnabled', enabled, { shouldDirty: true });
    // Turning it on with nothing typed yet starts at the common .99 ending.
    if (enabled && !isEndingValid) {
      setValue('fees.priceEndingCents', DEFAULT_PRICE_ENDING_CENTS, { shouldDirty: true });
    }
    // Turning it off hides the field, so an invalid leftover must not stay
    // behind and fail the save on an input the seller can no longer see.
    if (!enabled && !isEndingValid) {
      setValue('fees.priceEndingCents', undefined, { shouldDirty: true });
    }
    clearErrors('fees.priceEndingCents');
  };

  // Preview Logic
  const watchedTemplates = useWatch({ control, name: 'templates' });

  // Remembered so a custom template that started as a ready-made one keeps
  // previewing with that template's own sample data (the id is cleared on switch).
  const [lastPredefinedId, setLastPredefinedId] = useState<string | undefined>(undefined);
  if (watchedTemplates?.predefinedTemplateId && watchedTemplates.predefinedTemplateId !== lastPredefinedId) {
    setLastPredefinedId(watchedTemplates.predefinedTemplateId);
  }

  const activeTemplate = useMemo(() => {
    if (watchedTemplates?.type === TemplateType.CUSTOM) {
      const base = templates.find((tpl: PredefinedTemplateResponse) => tpl.id === lastPredefinedId);
      return {
        htmlContent: watchedTemplates.customTemplateHtml || '',
        // No ready-made template was picked first: preview with the same
        // unbranded, public-domain sample product as the Tech Gadgets template.
        sampleData: base?.sampleData ?? {
          title: t('listingSettingsGroup.sample.productTitle'),
          main_image: '/template-samples/wireless-earbuds.jpg',
          product_description: t('listingSettingsGroup.sample.productDescription'),
          has_features: '1',
          has_details: '1',
          feature_bullets: [
            'Active noise cancelling for travel and focus',
            '40 hours total with the charging case',
            'Low-latency mode for gaming',
            'IPX5 sweat and water resistant',
          ],
          product_details: ['Connectivity: Bluetooth 5.3', 'Battery Life: 40 Hours', 'Color: Black'],
        },
      };
    }
    const template = templates.find((t: PredefinedTemplateResponse) => t.id === watchedTemplates?.predefinedTemplateId);
    return {
      htmlContent: template?.htmlContent || '',
      sampleData: template?.sampleData || {},
    };
  }, [
    t,
    watchedTemplates?.type,
    watchedTemplates?.predefinedTemplateId,
    lastPredefinedId,
    watchedTemplates?.customTemplateHtml,
    templates,
  ]);

  // Preview and the published listing MUST go through the same renderer — a
  // second, drifting implementation here is what let the backend publish raw
  // `{{{product_description}}}` while this panel looked perfect.
  const renderedPreview = useMemo(
    () => renderListingTemplate(activeTemplate.htmlContent || '', activeTemplate.sampleData ?? {}),
    [activeTemplate]
  );

  const customTemplateRef = useRef<HTMLTextAreaElement | null>(null);
  // Clicking a keyword button blurs the textarea, so the live selection is read
  // here while it is still trustworthy. `null` = never placed, so an insert
  // appends rather than landing at index 0 (a blurred textarea reports 0, which
  // is indistinguishable from the caret genuinely sitting at the start).
  const templateSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const handleCustomTemplateSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    templateSelectionRef.current = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
  };

  // Fallback caret restore only — the execCommand path below never needs it.
  const customHtml = watchedTemplates?.customTemplateHtml;
  useEffect(() => {
    const el = customTemplateRef.current;
    const caret = pendingCaretRef.current;
    if (el && caret !== null) {
      pendingCaretRef.current = null;
      el.focus();
      el.setSelectionRange(caret, caret);
    }
  }, [customHtml]);

  const selectedTemplateValue =
    watchedTemplates?.type === TemplateType.CUSTOM
      ? CUSTOM_TEMPLATE_OPTION
      : watchedTemplates?.predefinedTemplateId ?? '';

  /**
   * Picking a row in the Active Template select DISCARDS any custom HTML.
   *
   * Keeping it would make the select lie: the seller picks "Gallery Grid", then
   * picks Custom again and is handed whatever they had typed against some other
   * template — code the preview above no longer matches. The pencil beside the
   * preview is the non-destructive route, since it carries the current
   * template's own code across.
   */
  const handleTemplateChange = (value: string | number) => {
    const isCustom = value === CUSTOM_TEMPLATE_OPTION;
    templateSelectionRef.current = null;
    setValue('templates.customTemplateHtml', '');
    setValue('templates.predefinedTemplateId', isCustom ? undefined : String(value));
    setValue('templates.type', isCustom ? TemplateType.CUSTOM : TemplateType.PREDEFINED, {
      shouldValidate: true,
    });
  };

  /** Pencil beside the preview: customize the template currently being shown. */
  const handleEditTemplate = () => {
    templateSelectionRef.current = null;
    setValue('templates.customTemplateHtml', activeTemplate.htmlContent);
    setValue('templates.predefinedTemplateId', undefined);
    setValue('templates.type', TemplateType.CUSTOM, { shouldValidate: true });
  };

  /**
   * Drops `{{key}}` at the caret (replacing any selection).
   *
   * The insert goes through the browser's own `insertText` command rather than
   * `setValue`. Writing the new string into a controlled <textarea> makes React
   * assign `node.value`, and assigning `value` resets the caret to the end — a
   * caret fix afterwards is a race against React's own commit, which is why the
   * earlier rAF/effect attempts kept losing it. `insertText` mutates the text
   * the way typing does: the browser itself leaves the caret after the inserted
   * token and emits a real `input` event, so RHF ends up holding exactly what
   * the DOM already shows and React never rewrites `value`. Undo (Ctrl+Z) keeps
   * working for the same reason.
   */
  const handleInsertKeyword = (key: ListingTemplatePlaceholder) => {
    const current = getValues('templates.customTemplateHtml') ?? '';
    const token = buildListingTemplateSnippet(key);
    const el = customTemplateRef.current;
    const selection = templateSelectionRef.current;
    const start = selection ? selection.start : current.length;
    const end = selection ? selection.end : current.length;

    if (el && typeof document.execCommand === 'function') {
      el.focus();
      el.setSelectionRange(start, end);
      if (document.execCommand('insertText', false, token)) {
        templateSelectionRef.current = { start: start + token.length, end: start + token.length };
        return;
      }
    }

    setValue('templates.customTemplateHtml', current.slice(0, start) + token + current.slice(end), {
      shouldDirty: true,
      shouldValidate: true,
    });
    templateSelectionRef.current = { start: start + token.length, end: start + token.length };
    pendingCaretRef.current = start + token.length;
  };

  const handleOpenPreview = () => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>${t('listingSettingsGroup.livePreview')}</title></head>
        <body style="margin:0;padding:0;">
          ${renderedPreview}
        </body>
        </html>
      `);
      win.document.close();
    }
  };

  // Soft gate for Continue — values only, never RHF trigger() (trigger paints red errors)
  const watchedValues = useWatch({ control });
  const canProceed = useMemo(() => {
    const v = watchedValues;
    if (!v) {
      return false;
    }
    switch (currentStep) {
      case 0: {
        const qty = Number(v.stock?.defaultQuantity);
        const buf = Number(v.stock?.stockBuffer ?? 0);
        return Boolean(v.name?.trim()) && Number.isFinite(qty) && qty >= 1 && Number.isFinite(buf) && buf >= 0;
      }
      case 1: {
        const fee = Number(v.fees?.ebayFeePercent);
        const fixed = Number(v.fees?.fixedFeeAmount);
        return Number.isFinite(fee) && fee >= 0 && fee <= 100 && Number.isFinite(fixed) && fixed >= 0;
      }
      case 2: {
        const ranges = v.repricingStrategy ?? [];
        if (ranges.length === 0) {
          return false;
        }
        if (v.fees?.priceRoundingEnabled) {
          const rawCents = v.fees.priceEndingCents as unknown;
          const cents =
            rawCents === undefined || rawCents === null || String(rawCents).trim() === '' ? NaN : Number(rawCents);
          if (!Number.isInteger(cents) || cents < 0 || cents > 99) {
            return false;
          }
        }
        return ranges.every((r) => {
          const min = Number(r.minPrice);
          const max = Number(r.maxPrice);
          const hasMargin =
            r.profitMarginPercent !== undefined &&
            r.profitMarginPercent !== null &&
            !Number.isNaN(Number(r.profitMarginPercent));
          const hasFixed =
            r.fixedProfitAmount !== undefined &&
            r.fixedProfitAmount !== null &&
            !Number.isNaN(Number(r.fixedProfitAmount));
          return Number.isFinite(min) && Number.isFinite(max) && max > min && (hasMargin || hasFixed);
        });
      }
      case RULES_STEP:
        // Validated on Continue, so the seller sees which field to fix.
        return true;
      case LAST_STEP: {
        if (v.templates?.type === TemplateType.CUSTOM) {
          return Boolean(v.templates?.customTemplateHtml?.trim());
        }
        return Boolean(v.templates?.predefinedTemplateId);
      }
      default:
        return false;
    }
  }, [currentStep, watchedValues]);

  // The gate above only reads values, so it cannot tell "025" from "25" (Number()
  // accepts both). The schema can: on Continue, run it over THIS step's fields and
  // stay put with the error painted under the field if it refuses.
  // Continue is never disabled (validate on click): an incomplete step runs the
  // schema over its own fields so the empty / wrong field turns red under itself,
  // and the wizard stays put.
  const handleNext = async () => {
    if (currentStep >= LAST_STEP) {
      return;
    }
    if (currentStep === RULES_STEP && rulesError !== null) {
      setRulesAttempted(true);
      return;
    }
    const stepFields = STEP_FIELDS[currentStep];
    const fieldsValid = stepFields ? await trigger(stepFields) : true;
    if (!fieldsValid || !canProceed) {
      return;
    }
    clearErrors();
    setCurrentStep((currentStep + 1) as ListingGroupDrawerStep);
  };

  const handleBack = () => {
    // Header back arrow: previous step when mid-wizard, otherwise close.
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as ListingGroupDrawerStep);
    } else {
      onClose();
    }
  };

  const handleStepChange = (step: ListingGroupDrawerStep) => {
    clearErrors();
    setCurrentStep(step);
  };

  const handleSubmit = () => {
    // The stepper lets the seller jump past the Rules step, so it is checked again here.
    if (rulesError !== null) {
      setRulesAttempted(true);
      setCurrentStep(RULES_STEP);
      return;
    }
    void rhfSubmit(
      (data: ListingSettingsGroupFormData) => {
        const cleanData = {
          ...data,
          repricingStrategy: data.repricingStrategy.map(({ id: _id, ...rest }) => rest),
          listingRules: fromListingRulesDraft(rulesDraft),
        };

        if (isEdit && editingGroupId) {
          void updateListingSettingsGroup({ id: editingGroupId, data: cleanData });
        } else {
          void createListingSettingsGroup(cleanData);
        }
      },
      () => {
        // Validation failed — surface it instead of failing silently. The wizard
        // keeps every step mounted so values are never lost on navigation; if we
        // still get here the user has genuinely invalid data on the current step.
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'listingSettingsGroup:listingSettingsGroup.errors.saveFailed',
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      }
    )();
  };

  return (
    <ListingGroupDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      isEdit={isEdit}
      isLoading={isLoading}
      isSaving={isSaving}
      form={form}
      fields={fields}
      append={append}
      remove={remove}
      onAddRange={handleAddRange}
      isPriceRoundingEnabled={isPriceRoundingEnabled}
      onPriceRoundingToggle={handlePriceRoundingToggle}
      priceRoundingExample={priceRoundingExample}
      templateOptions={templateOptions}
      selectedTemplateValue={selectedTemplateValue}
      onTemplateChange={handleTemplateChange}
      onEditTemplate={handleEditTemplate}
      renderedPreview={renderedPreview}
      onOpenPreview={handleOpenPreview}
      onCustomTemplateRef={(node) => {
        customTemplateRef.current = node;
      }}
      onCustomTemplateSelect={handleCustomTemplateSelect}
      onInsertKeyword={handleInsertKeyword}
      onNext={() => void handleNext()}
      onBack={handleBack}
      onSubmit={handleSubmit}
      rulesStep={{
        draft: rulesDraft,
        onChange: (changes) => setRulesDraft((current) => ({ ...current, ...changes })),
        outOfStockOptions: [
          { value: '', label: t('listingSettingsGroup.rules.cleanup.never') },
          ...Array.from(new Set([...OUT_OF_STOCK_CHOICES, rulesDraft.outOfStockEndDays].filter(Boolean)))
            .sort((a, b) => Number(a) - Number(b))
            .map((value) => ({
              value,
              label: t('listingSettingsGroup.rules.cleanup.afterDays', { count: Number(value) }),
            })),
        ],
        coldListingModeOptions: [ColdListingMode.FLAG, ColdListingMode.END].map((value) => ({
          value,
          label: t(`listingSettingsGroup.rules.cleanup.coldMode_${value}`),
        })),
        minRatingError: rulesErrorText(
          ListingRulesDraftError.MIN_RATING,
          t('listingSettingsGroup.rules.filters.minRatingError')
        ),
        priceError: rulesErrorText(ListingRulesDraftError.PRICE, t('listingSettingsGroup.rules.filters.priceError')),
        coldListingDaysError: rulesErrorText(
          ListingRulesDraftError.COLD_DAYS,
          t('listingSettingsGroup.rules.cleanup.coldDaysError', {
            min: COLD_LISTING_MIN_DAYS,
            max: LISTING_CLEANUP_MAX_DAYS,
          })
        ),
      }}
    />
  );
};

ListingGroupDrawer.displayName = 'ListingGroupDrawer';

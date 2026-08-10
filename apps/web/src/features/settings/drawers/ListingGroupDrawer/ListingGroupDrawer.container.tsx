import { zodResolver } from '@hookform/resolvers/zod';
import {
  TemplateType,
  listingSettingsGroupSchema,
  renderListingTemplate,
  type ListingSettingsGroupFormData,
  type PredefinedTemplateResponse,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ListingGroupDrawerComponent } from './ListingGroupDrawer.component';
import type { ListingGroupDrawerProps, ListingGroupDrawerStep } from './ListingGroupDrawer.types';

import {
  useCreateListingSettingsGroupMutation,
  useGetListingSettingsGroupByIdQuery,
  useGetPredefinedTemplatesQuery,
  useUpdateListingSettingsGroupMutation,
} from '@/features/listing-settings-groups/api/listing-settings-group.api';
import { predefinedTemplateName } from '@/features/settings/utils/predefinedTemplateLabel';

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
  const predefinedTemplateOptions = useMemo(
    () => templates.map((template) => ({ value: template.id, label: predefinedTemplateName(t, template) })),
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
      fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
      templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: undefined },
      content: {
        stripBrandFromTitle: false,
        aiTitleEnabled: false,
        aiDescriptionEnabled: false,
      },
    },
  });

  const { reset, control, getValues, clearErrors, handleSubmit: rhfSubmit } = form;

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
        fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
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
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: createSuccess
            ? 'listingSettingsGroup:listingSettingsGroup.success.created'
            : 'listingSettingsGroup:listingSettingsGroup.success.updated',
          primaryButton: {
            labelKey: 'translation:common.ok',
            onClick: () => {
              closeMessage();
              onClose();
            },
          },
        },
        t
      );
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

    // Start exactly where the previous range ends so the price buckets tile
    // continuously (no gap, no overlap). The schema allows contiguity
    // (minPrice === prev.maxPrice), so this is always valid — no +epsilon hack.
    append({
      id: crypto.randomUUID(),
      minPrice: lastMax,
      maxPrice: 9999,
      profitMarginPercent: 15,
    });
  };

  // Preview Logic
  const watchedTemplates = useWatch({ control, name: 'templates' });

  const activeTemplate = useMemo(() => {
    if (watchedTemplates?.type === TemplateType.CUSTOM) {
      return {
        htmlContent: watchedTemplates.customTemplateHtml || '',
        sampleData: {
          title: t('listingSettingsGroup.sample.productTitle'),
          main_image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
          product_description: t('listingSettingsGroup.sample.productDescription'),
          feature_bullets: [
            'Industry-leading noise cancellation',
            'Up to 30-hour battery life',
            'Touch sensor controls',
            'Quick attention mode',
          ],
          product_details: [
            'Brand: Zonds Audio',
            'Connectivity: Bluetooth 5.0',
            'Noise Cancelling: Yes',
            'Color: Silver',
          ],
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
        const tax = Number(v.fees?.taxPercent);
        return (
          Number.isFinite(fee) &&
          fee >= 0 &&
          fee <= 100 &&
          Number.isFinite(fixed) &&
          fixed >= 0 &&
          Number.isFinite(tax) &&
          tax >= 0 &&
          tax <= 100
        );
      }
      case 2: {
        const ranges = v.repricingStrategy ?? [];
        if (ranges.length === 0) {
          return false;
        }
        return ranges.every((r) => {
          const min = Number(r.minPrice);
          const max = Number(r.maxPrice);
          const hasMargin = r.profitMarginPercent !== undefined && r.profitMarginPercent !== null && !Number.isNaN(Number(r.profitMarginPercent));
          const hasFixed = r.fixedProfitAmount !== undefined && r.fixedProfitAmount !== null && !Number.isNaN(Number(r.fixedProfitAmount));
          return Number.isFinite(min) && Number.isFinite(max) && max > min && (hasMargin || hasFixed);
        });
      }
      case 3: {
        if (v.templates?.type === TemplateType.CUSTOM) {
          return Boolean(v.templates?.customTemplateHtml?.trim());
        }
        return Boolean(v.templates?.predefinedTemplateId);
      }
      default:
        return false;
    }
  }, [currentStep, watchedValues]);

  const handleNext = () => {
    if (!canProceed || currentStep >= 3) {
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
    void rhfSubmit(
      (data: ListingSettingsGroupFormData) => {
        const cleanData = {
          ...data,
          repricingStrategy: data.repricingStrategy.map(({ id: _id, ...rest }) => rest),
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
      predefinedTemplateOptions={predefinedTemplateOptions}
      renderedPreview={renderedPreview}
      activeTemplate={activeTemplate}
      onOpenPreview={handleOpenPreview}
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      canProceed={canProceed}
    />
  );
};

ListingGroupDrawer.displayName = 'ListingGroupDrawer';

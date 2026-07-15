import { zodResolver } from '@hookform/resolvers/zod';
import {
  TemplateType,
  listingSettingsGroupSchema,
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

/** Fields validated per wizard step. Hoisted to module scope so the
 *  step-validation effect can reference it without re-running every render. */
const STEP_FIELDS: Record<ListingGroupDrawerStep, string[]> = {
  0: ['name', 'stock.defaultQuantity', 'stock.stockBuffer'],
  1: ['fees.ebayFeePercent', 'fees.fixedFeeAmount', 'fees.taxPercent'],
  2: ['repricingStrategy'],
  3: ['templates'],
};

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
  useLoading(isLoading || isSaving);

  // Form Initialization
  const form = useForm<ListingSettingsGroupFormData>({
    resolver: zodResolver(listingSettingsGroupSchema(t)) as any,
    defaultValues: {
      name: '',
      description: '',
      repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
      stock: { defaultQuantity: 1, stockBuffer: 0 },
      fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
      templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: undefined },
    },
  });

  const { reset, control, getValues, trigger, handleSubmit: rhfSubmit } = form;

  // Sync form with data when editing
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (group) {
      const strategies = group.repricingStrategy.map((s) => ({ ...s, id: s.id || crypto.randomUUID() }));
      reset({ ...group, repricingStrategy: strategies });
    } else if (!isEdit) {
      // Reset to defaults for create mode
      reset({
        name: '',
        description: '',
        repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
        stock: { defaultQuantity: 1, stockBuffer: 0 },
        fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
        templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: templates[0]?.id },
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

  const renderedPreview = useMemo(() => {
    const { htmlContent, sampleData } = activeTemplate;

    let processedHtml = htmlContent || '';
    if (!sampleData) {
      return processedHtml;
    }

    Object.entries(sampleData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const blockRegex = new RegExp(`{{#${key}}}(.*?){{/${key}}}`, 'gs');
        processedHtml = processedHtml.replace(blockRegex, (_, inner) => {
          return value.map((item) => inner.replace(/{{.}}/g, String(item))).join('\n');
        });

        const listHtml = value.map((item) => `<li>${item}</li>`).join('\n');
        processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), `<ul>${listHtml}</ul>`);
      } else {
        const regex = new RegExp(`{{{?${key}}}?}`, 'g');
        processedHtml = processedHtml.replace(regex, String(value));
      }
    });

    return processedHtml;
  }, [activeTemplate]);

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

  // Step validation — validate only the fields relevant to the current step
  const [canProceed, setCanProceed] = useState(true);

  // Re-check validity whenever step or form values change
  const watchedValues = useWatch({ control });
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void (async () => {
      const fieldsToValidate = STEP_FIELDS[currentStep];
      const valid = await trigger(fieldsToValidate as any, { shouldFocus: false });
      setCanProceed(valid);
    })();
  }, [currentStep, watchedValues, trigger, isOpen]);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as ListingGroupDrawerStep);
    }
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
      predefinedTemplates={templates}
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

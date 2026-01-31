import { zodResolver } from '@hookform/resolvers/zod';
import {
  listingSettingsGroupSchema,
  type ListingSettingsGroupFormData,
  type PredefinedTemplateResponse,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCreateListingSettingsGroupMutation,
  useGetListingSettingsGroupByIdQuery,
  useGetPredefinedTemplatesQuery,
  useUpdateListingSettingsGroupMutation,
} from '../api/listing-settings-group.api';
import { ListingSettingsGroupFormComponent } from './ListingSettingsGroupForm.component';

export const ListingSettingsGroupFormContainer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { showMessage } = useUI();
  const isEdit = !!id;

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const { data: group, isLoading: isGroupLoading } = useGetListingSettingsGroupByIdQuery(id!, { skip: !isEdit });
  const { data: templates = [], isLoading: isTemplatesLoading } = useGetPredefinedTemplatesQuery();
  const [createListingSettingsGroup, { isLoading: isCreating, isSuccess: createSuccess, isError: createError }] =
    useCreateListingSettingsGroupMutation();
  const [updateListingSettingsGroup, { isLoading: isUpdating, isSuccess: updateSuccess, isError: updateError }] =
    useUpdateListingSettingsGroupMutation();

  useLoading(isGroupLoading || isTemplatesLoading || isCreating || isUpdating);

  // Form Initialization
  const form = useForm<ListingSettingsGroupFormData>({
    resolver: zodResolver(listingSettingsGroupSchema(t)) as any,
    defaultValues: {
      name: '',
      description: '',
      repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
      stock: { defaultQuantity: 1, autoRestock: true },
      fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
      templates: { type: 'predefined', predefinedTemplateId: templates[0]?.id },
    },
  });

  const { reset, watch, control, getValues } = form;

  // Sync form with data
  useEffect(() => {
    if (group) {
      // Ensure id is present for repricing strategy items if not provided by backend logic (though it should be)
      const strategies = group.repricingStrategy.map((s) => ({ ...s, id: s.id || crypto.randomUUID() }));
      reset({ ...group, repricingStrategy: strategies });
    } else if (templates.length > 0 && !getValues('templates.predefinedTemplateId')) {
      // Set default template if creating new and templates loaded
      form.setValue('templates.predefinedTemplateId', templates[0].id);
    }
  }, [group, templates, reset, getValues, form]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'repricingStrategy',
  });

  // Handle success
  useEffect(() => {
    if (createSuccess || updateSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: createSuccess
            ? 'listingSettingsGroup:listingSettingsGroup.success.created'
            : 'listingSettingsGroup:listingSettingsGroup.success.updated',
        },
        t
      );
      navigate('/settings/listing-groups');
    }
  }, [createSuccess, updateSuccess, showMessage, t, navigate]);

  // Handle error
  useEffect(() => {
    if (createError || updateError) {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'listingSettingsGroup:listingSettingsGroup.errors.saveFailed',
        },
        t
      );
    }
  }, [createError, updateError, showMessage, t]);

  const handleSubmit = (data: ListingSettingsGroupFormData) => {
    // Remove ids from repricing strategy before sending if necessary, or backend handles it.
    // Assuming backend handles DTO transformation, we just pass the form data.
    // However, the randomUUIDs are for frontend keys mostly.
    // Let's pass as is, assuming DTO handles it.
    const cleanData = {
      ...data,
      repricingStrategy: data.repricingStrategy.map(({ id, ...rest }) => rest),
    };

    if (isEdit) {
      void updateListingSettingsGroup({ id: id!, data: cleanData });
    } else {
      void createListingSettingsGroup(cleanData);
    }
  };

  const handleCancel = () => {
    navigate('/settings/listing-groups');
  };

  const handleAddRange = () => {
    const strategies = getValues('repricingStrategy');
    const lastStrategy = strategies?.length ? strategies[strategies.length - 1] : null;
    const lastMax = lastStrategy ? Number(lastStrategy.maxPrice) : 0;
    const newMin = lastMax; // Start exactly at the previous max price as requested

    append({
      id: crypto.randomUUID(),
      minPrice: newMin,
      maxPrice: 9999,
      profitMarginPercent: 15,
    });
  };

  // Preview Logic
  const watchedValues = watch();

  const activeTemplate = useMemo(() => {
    if (watchedValues.templates?.type === 'custom') {
      return {
        htmlContent: watchedValues.templates.customTemplateHtml || '',
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
    const template = templates.find(
      (t: PredefinedTemplateResponse) => t.id === watchedValues.templates?.predefinedTemplateId
    );
    return {
      htmlContent: template?.htmlContent || '',
      sampleData: template?.sampleData || {},
    };
  }, [
    watchedValues.templates?.type,
    watchedValues.templates?.predefinedTemplateId,
    watchedValues.templates?.customTemplateHtml,
    templates,
  ]);

  const renderedPreview = useMemo(() => {
    const { htmlContent, sampleData } = activeTemplate;

    let processedHtml = htmlContent || '';
    if (!sampleData) return processedHtml;

    Object.entries(sampleData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const blockRegex = new RegExp(`{{#${key}}}(.*?){{/${key}}}`, 'gs');
        processedHtml = processedHtml.replace(blockRegex, (_, inner) => {
          return value.map((item) => inner.replace(/{{.}}/g, String(item))).join('\n');
        });

        const listHtml = value.map((item) => `<li>${item}</li>`).join('\n');
        processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), `<ul>${listHtml}</ul>`);
      } else {
        const regex = new RegExp(`{{{?${key}}}?`, 'g');
        processedHtml = processedHtml.replace(regex, String(value));
      }
    });

    return processedHtml;
  }, [activeTemplate]);

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  return (
    <ListingSettingsGroupFormComponent
      isEdit={isEdit}
      defaultValues={group}
      predefinedTemplates={templates}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isLoading={isCreating || isUpdating}
      form={form}
      fields={fields}
      append={append}
      remove={remove}
      onAddRange={handleAddRange}
      previewDevice={previewDevice}
      setPreviewDevice={setPreviewDevice}
      renderedPreview={renderedPreview}
      getPreviewWidth={getPreviewWidth}
      activeTemplate={activeTemplate}
    />
  );
};

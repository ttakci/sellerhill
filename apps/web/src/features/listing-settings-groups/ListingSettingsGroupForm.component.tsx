import { zodResolver } from '@hookform/resolvers/zod';
import { listingSettingsGroupSchema, type ListingSettingsGroupFormData, type PredefinedTemplateResponse } from '@repo/shared';
import { Button, Icon, Select, SwitchRow, Text, TextInput } from '@repo/ui';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as S from './ListingSettingsGroupForm.style';
import { ListingSettingsGroupFormProps } from './ListingSettingsGroupForm.types';

export const ListingSettingsGroupFormComponent = ({
  defaultValues,
  predefinedTemplates,
  onSubmit,
  onCancel,
  isLoading,
}: ListingSettingsGroupFormProps) => {
  const { t } = useTranslation();
  const [isPreviewDarkMode, setIsPreviewDarkMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ListingSettingsGroupFormData>({
    resolver: zodResolver(listingSettingsGroupSchema(t)),
    defaultValues: {
      name: '',
      description: '',
      repricingStrategy: [{ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 }],
      stock: { defaultQuantity: 1, autoRestock: true },
      fees: { ebayFeePercent: 13.25, fixedFeeAmount: 0.3, taxPercent: 0 },
      templates: { type: 'predefined', predefinedTemplateId: predefinedTemplates[0]?.id },
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'repricingStrategy',
  });

  const watchedValues = watch();

  const renderedPreview = useMemo(() => {
    let html = '';
    let sampleData: Record<string, string> = {};

    if (watchedValues.templates.type === 'custom') {
      html = watchedValues.templates.customTemplateHtml || '';
      // Fallback sample data for custom templates
      sampleData = {
        product_title: 'Custom Template Product',
        product_price: '199.99',
        product_image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
        product_description: 'This is your custom template description.',
        product_specs: '<ul><li>Feature A</li><li>Feature B</li></ul>',
      };
    } else {
      const template = predefinedTemplates.find((t: PredefinedTemplateResponse) => t.id === watchedValues.templates.predefinedTemplateId);
      html = template?.htmlContent || '';
      sampleData = template?.sampleData || {};
    }

    let processedHtml = html;
    Object.entries(sampleData).forEach(([key, value]) => {
      processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return processedHtml;
  }, [watchedValues.templates, predefinedTemplates]);

  return (
    <S.FormContainer onSubmit={handleSubmit(onSubmit)}>
      <S.MainLayout>
        <S.FormSections>
          {/* Group Details */}
          <S.SectionCard>
            <S.SectionHeader>
              <Icon name="settings" size={20} color="brand.primary" />
              <Text variant="h4" weight="bold">{t('listingSettingsGroup.groupDetails')}</Text>
            </S.SectionHeader>
            <S.SectionContent>
              <TextInput
                name="name"
                control={control}
                label={t('listingSettingsGroup.groupName')}
              />
              <TextInput
                name="description"
                control={control}
                label={t('listingSettingsGroup.description')}
              />
            </S.SectionContent>
          </S.SectionCard>

          {/* Repricing Strategy */}
          <S.SectionCard>
            <S.SectionHeader>
              <Icon name="grid" size={20} color="brand.primary" />
              <Text variant="h4" weight="bold">{t('listingSettingsGroup.repricingStrategy')}</Text>
            </S.SectionHeader>
            <S.SectionContent>
              {fields.map((field, index) => (
                <S.PriceRangeRow key={field.id}>
                  <Text variant="caption" weight="bold" color="brand.primary">
                    {t('listingSettingsGroup.priceRangeLabel', { index: index + 1 })}
                  </Text>
                  {fields.length > 1 && (
                    <S.RemoveButton type="button" onClick={() => remove(index)}>
                      <Icon name="trash" size={14} />
                    </S.RemoveButton>
                  )}
                  <S.InputGrid>
                    <TextInput
                      name={`repricingStrategy.${index}.minPrice`}
                      control={control}
                      type="number"
                      label={t('listingSettingsGroup.minPrice')}
                    />
                    <TextInput
                      name={`repricingStrategy.${index}.maxPrice`}
                      control={control}
                      type="number"
                      label={t('listingSettingsGroup.maxPrice')}
                    />
                    <TextInput
                      name={`repricingStrategy.${index}.profitMarginPercent`}
                      control={control}
                      type="number"
                      label={t('listingSettingsGroup.profitMargin')}
                    />
                    <TextInput
                      name={`repricingStrategy.${index}.fixedProfitAmount`}
                      control={control}
                      type="number"
                      label={t('listingSettingsGroup.fixedProfit')}
                    />
                  </S.InputGrid>
                </S.PriceRangeRow>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ id: crypto.randomUUID(), minPrice: 0, maxPrice: 100, profitMarginPercent: 15 })}
                style={{ width: 'fit-content' }}
              >
                <Icon name="plus" size={16} />
                {t('listingSettingsGroup.addPriceRange')}
              </Button>
            </S.SectionContent>
          </S.SectionCard>

          {/* Stock & Fees */}
          <S.InputGrid columns={2}>
            <S.SectionCard>
              <S.SectionHeader>
                <Icon name="box" size={20} color="brand.primary" />
                <Text variant="h4" weight="bold">{t('listingSettingsGroup.stock')}</Text>
              </S.SectionHeader>
              <S.SectionContent>
                <TextInput
                  name="stock.defaultQuantity"
                  control={control}
                  type="number"
                  label={t('listingSettingsGroup.defaultQuantity')}
                />
                <Controller
                  name="stock.autoRestock"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      title={t('listingSettingsGroup.autoRestock')}
                      description={t('listingSettingsGroup.autoRestockDescription')}
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </S.SectionContent>
            </S.SectionCard>

            <S.SectionCard>
              <S.SectionHeader>
                <Icon name="shopping-cart" size={20} color="brand.primary" />
                <Text variant="h4" weight="bold">{t('listingSettingsGroup.fees')}</Text>
              </S.SectionHeader>
              <S.SectionContent>
                <S.InputGrid columns={2}>
                  <TextInput
                    name="fees.ebayFeePercent"
                    control={control}
                    type="number"
                    label={t('listingSettingsGroup.ebayFeePercent')}
                  />
                  <TextInput
                    name="fees.fixedFeeAmount"
                    control={control}
                    type="number"
                    label={t('listingSettingsGroup.fixedFeeAmount')}
                  />
                </S.InputGrid>
                <TextInput
                  name="fees.taxPercent"
                  control={control}
                  type="number"
                  label={t('listingSettingsGroup.taxPercent')}
                />
              </S.SectionContent>
            </S.SectionCard>
          </S.InputGrid>

          {/* Template Selection */}
          <S.SectionCard>
            <S.SectionHeader>
              <Icon name="check-list" size={20} color="brand.primary" />
              <Text variant="h4" weight="bold">{t('listingSettingsGroup.templates')}</Text>
            </S.SectionHeader>
            <S.SectionContent>
              <S.TemplateTypeToggle>
                <S.ToggleItem
                  type="button"
                  active={watchedValues.templates.type === 'predefined'}
                  onClick={() => setValue('templates.type', 'predefined')}
                >
                  {t('listingSettingsGroup.predefinedTemplate')}
                </S.ToggleItem>
                <S.ToggleItem
                  type="button"
                  active={watchedValues.templates.type === 'custom'}
                  onClick={() => setValue('templates.type', 'custom')}
                >
                  {t('listingSettingsGroup.customTemplate')}
                </S.ToggleItem>
              </S.TemplateTypeToggle>

              {watchedValues.templates.type === 'predefined' ? (
                <Controller
                  name="templates.predefinedTemplateId"
                  control={control}
                  render={({ field }) => (
                    <S.FormGroup>
                      <Text variant="caption" weight="medium">{t('listingSettingsGroup.selectTemplate')}</Text>
                      <Select
                        options={predefinedTemplates.map((tmp: PredefinedTemplateResponse) => ({ value: tmp.id, label: tmp.name }))}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </S.FormGroup>
                  )}
                />
              ) : (
                <TextInput
                  name="templates.customTemplateHtml"
                  control={control}
                  label={t('listingSettingsGroup.htmlEditor')}
                />
              )}
            </S.SectionContent>
          </S.SectionCard>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              {t('listingSettingsGroup.cancel')}
            </Button>
            <Button variant="primary" type="submit" isLoading={isLoading}>
              {t('listingSettingsGroup.saveChanges')}
            </Button>
          </div>
        </S.FormSections>

        {/* Live Preview Sidebar */}
        <S.PreviewSidebar>
          <Text variant="h4" weight="bold" style={{ marginBottom: '16px' }}>
            {t('listingSettingsGroup.livePreview')}
          </Text>
          <S.PreviewContainer>
            <S.PreviewToolbar>
              <div style={{ display: 'flex', gap: '8px' }}>
                <S.IconButton 
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  title={t('listingSettingsGroup.tooltips.switchToDesktop')}
                  $active={previewDevice === 'desktop'}
                >
                  <Icon name="grid" size={16} />
                </S.IconButton>
                <S.IconButton 
                   type="button"
                   onClick={() => setPreviewDevice('mobile')}
                   title={t('listingSettingsGroup.tooltips.switchToMobile')}
                   $active={previewDevice === 'mobile'}
                >
                  <Icon name="settings" size={16} />
                </S.IconButton>
              </div>
              <S.IconButton 
                 type="button"
                 onClick={() => setIsPreviewDarkMode(!isPreviewDarkMode)}
                 title={t('listingSettingsGroup.tooltips.toggleDarkMode')}
              >
                <Icon name={isPreviewDarkMode ? 'sun' : 'moon'} size={16} />
              </S.IconButton>
            </S.PreviewToolbar>
            <div style={{ 
              flex: 1, 
              background: isPreviewDarkMode ? '#1a1a1a' : '#ffffff',
              padding: previewDevice === 'mobile' ? '20px 40px' : '0',
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <div style={{
                width: previewDevice === 'mobile' ? '320px' : '100%',
                height: '100%',
                background: 'white',
                boxShadow: previewDevice === 'mobile' ? '0 10px 40px rgba(0,0,0,0.2)' : 'none',
                overflowY: 'auto'
              }}>
                <div dangerouslySetInnerHTML={{ __html: renderedPreview }} />
              </div>
            </div>
          </S.PreviewContainer>
          <div style={{ marginTop: '16px' }}>
            <Text variant="caption" color="text.secondary">
              <Icon name="info" size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {t('listingSettingsGroup.templateVariablesHelp')}
            </Text>
          </div>
        </S.PreviewSidebar>
      </S.MainLayout>
    </S.FormContainer>
  );
};

import { zodResolver } from '@hookform/resolvers/zod';
import { listingSettingsGroupSchema, type ListingSettingsGroupFormData, type PredefinedTemplateResponse } from '@repo/shared';
import { Button, Card, CardBody, Icon, Select, Text, TextInput } from '@repo/ui';
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as S from './ListingSettingsGroupForm.style';
import { ListingSettingsGroupFormProps } from './ListingSettingsGroupForm.types';

export const ListingSettingsGroupFormComponent = ({
  isEdit,
  defaultValues,
  predefinedTemplates,
  onSubmit,
  onCancel,
  isLoading,
}: ListingSettingsGroupFormProps) => {
  const { t } = useTranslation('listingSettingsGroup');


  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ListingSettingsGroupFormData>({
    resolver: zodResolver(listingSettingsGroupSchema(t)) as any,
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

  const handleAddRange = () => {
    const strategies = getValues('repricingStrategy');
    const lastStrategy = strategies?.length ? strategies[strategies.length - 1] : null;
    const lastMax = lastStrategy ? Number(lastStrategy.maxPrice) : 0;
    const newMin = lastStrategy ? Number((lastMax + 0.1).toFixed(2)) : 0;

    append({ 
      id: crypto.randomUUID(), 
      minPrice: newMin, 
      maxPrice: 9999, 
      profitMarginPercent: 15 
    });
  };

  const activeTemplate = useMemo(() => {
    if (watchedValues.templates.type === 'custom') {
      return {
        htmlContent: watchedValues.templates.customTemplateHtml || '',
        sampleData: {
          title: 'Premium Wireless Noise Cancelling Headphones - Silver Edition',
          main_image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
          product_description: 'Experience world-class noise cancellation and premium sound quality with these high-end wireless headphones. Perfect for travel, work, or pure listening pleasure.',
          feature_bullets: ['Industry-leading noise cancellation', 'Up to 30-hour battery life', 'Touch sensor controls', 'Quick attention mode'],
          product_details: ['Brand: Zonds Audio', 'Connectivity: Bluetooth 5.0', 'Noise Cancelling: Yes', 'Color: Silver']
        }
      };
    }
    const template = predefinedTemplates.find((t: PredefinedTemplateResponse) => t.id === watchedValues.templates.predefinedTemplateId);
    return {
      htmlContent: template?.htmlContent || '',
      sampleData: template?.sampleData || {}
    };
  }, [watchedValues.templates.type, watchedValues.templates.predefinedTemplateId, watchedValues.templates.customTemplateHtml, predefinedTemplates]);

  const renderedPreview = useMemo(() => {
    const { htmlContent, sampleData } = activeTemplate;

    let processedHtml = htmlContent || '';
    Object.entries(sampleData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle Mustache-like blocks for arrays
        const blockRegex = new RegExp(`{{#${key}}}(.*?){{/${key}}}`, 'gs');
        processedHtml = processedHtml.replace(blockRegex, (_, inner) => {
          return value.map(item => inner.replace(/{{.}}/g, String(item))).join('\n');
        });
        
        // Also support direct replacement if used without block (compact fallback)
        const listHtml = value.map(item => `<li>${item}</li>`).join('\n');
        processedHtml = processedHtml.replace(new RegExp(`{{${key}}}`, 'g'), `<ul>${listHtml}</ul>`);
      } else {
        // Support both {{key}} and {{{key}}}
        const regex = new RegExp(`{{{?${key}}}?`, 'g');
        processedHtml = processedHtml.replace(regex, String(value));
      }
    });

    return processedHtml;
  }, [activeTemplate]);

  const getPreviewWidth = () => {
    switch(previewDevice) {
        case 'mobile': return '375px';
        case 'tablet': return '768px';
        default: return '100%';
    }
  };

  const renderPreviewContent = () => (
    <S.PreviewContainer>
      <S.PreviewViewport device={previewDevice}>
        <S.PreviewContent 
          width={getPreviewWidth()} 
          device={previewDevice}
        >
          <S.PreviewHTMLContent dangerouslySetInnerHTML={{ __html: renderedPreview }} />
        </S.PreviewContent>
      </S.PreviewViewport>
    </S.PreviewContainer>
  );

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.HeaderTitleGroup>
            <S.EditorTitle variant="h3" weight="bold">
              {t('listingSettingsGroup.editorTitle')}
            </S.EditorTitle>
          </S.HeaderTitleGroup>
          <Text variant="body" color="text.secondary">
            {t('listingSettingsGroup.editorDescription')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="primary" size="md" onClick={handleSubmit(onSubmit)} isLoading={isLoading}>
            <Icon name="check" size={18} />
            <Text variant="body" weight="medium" color="inherit">
              {t('listingSettingsGroup.saveChanges')}
            </Text>
          </Button>
        </S.Actions>
      </S.Header>

      <S.FormContainer onSubmit={handleSubmit(onSubmit)}>
        {/* General Settings & Stock - Combined Card */}
        <Card variant="bordered">
          <S.SectionHeader>
            <S.SectionTitleWrapper>
              <S.HeaderIconWrapper>
                <Icon name="settings" size={20} />
              </S.HeaderIconWrapper>
              <S.SectionTitleText>
                <Text variant="h4" weight="bold">{t('listingSettingsGroup.generalSettings')}</Text>
              </S.SectionTitleText>
            </S.SectionTitleWrapper>
          </S.SectionHeader>
          <CardBody>
            <S.InputGrid columns={3}>
              <TextInput<ListingSettingsGroupFormData>
                name="name"
                control={control}
                label={t('listingSettingsGroup.groupName')}
              />
              <TextInput<ListingSettingsGroupFormData>
                name="description"
                control={control}
                label={t('listingSettingsGroup.description')}
              />
              <S.StockInputWrapper>
                <TextInput<ListingSettingsGroupFormData>
                  name="stock.defaultQuantity"
                  control={control}
                  type="number"
                  label={t('listingSettingsGroup.defaultStockQuantity')}
                />
              </S.StockInputWrapper>
            </S.InputGrid>
          </CardBody>
        </Card>

        {/* Pricing Strategy */}
        <Card variant="bordered">
          <S.SectionHeader>
             <S.SectionTitleWrapper>
                <S.HeaderIconWrapper>
                  <Icon name="trending-up" size={20} />
                </S.HeaderIconWrapper>
                <Text variant="h4" weight="bold">{t('listingSettingsGroup.pricingStrategy')}</Text>
             </S.SectionTitleWrapper>
             <S.AddButton variant="primary" size="sm" type="button" onClick={handleAddRange}>
                <Icon name="plus" size={16} />
                {t('listingSettingsGroup.addRange')}
             </S.AddButton>
          </S.SectionHeader>
          <CardBody>
             <S.PriceRangesContainer>
              {fields.map((field, index) => (
                  <S.PriceRangeRow key={field.id}>
                      {index > 0 && (
                          <S.RemoveButton type="button" onClick={() => remove(index)}>
                             <Icon name="x" size={14} />
                          </S.RemoveButton>
                      )}
                      <S.InputGrid columns={4}>
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.minPrice`}
                          control={control}
                          type="number"
                          label={t('listingSettingsGroup.minPrice')}
                        />
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.maxPrice`}
                          control={control}
                          type="number"
                          label={t('listingSettingsGroup.maxPrice')}
                        />
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.profitMarginPercent`}
                          control={control}
                          type="number"
                          label={t('listingSettingsGroup.profitMargin')}
                        />
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.fixedProfitAmount`}
                          control={control}
                          type="number"
                          label={t('listingSettingsGroup.fixedProfit')}
                        />
                      </S.InputGrid>
                  </S.PriceRangeRow>
              ))}
            </S.PriceRangesContainer>
          </CardBody>
        </Card>

        {/* Split View: Template & Preview */}
        <S.SplitGrid>
           {/* Template Settings */}
           <S.TemplateSettingsCard variant="bordered">
              <S.SectionHeader>
                 <S.SectionTitleWrapper>
                  <S.HeaderIconWrapper>
                    <Icon name="code" size={20} />
                  </S.HeaderIconWrapper>
                  <Text variant="h4" weight="bold">{t('listingSettingsGroup.htmlTemplate')}</Text>
                 </S.SectionTitleWrapper>
                 <Controller
                    name="templates.type"
                    control={control}
                    render={({ field }) => (
                      <S.TemplateTypeToggle>
                        <S.ToggleItem
                          type="button"
                          active={field.value === 'custom'}
                          onClick={() => field.onChange('custom')}
                        >
                          {t('listingSettingsGroup.custom')}
                        </S.ToggleItem>
                        <S.ToggleItem
                          type="button"
                          active={field.value === 'predefined'}
                          onClick={() => field.onChange('predefined')}
                        >
                          {t('listingSettingsGroup.predefined')}
                        </S.ToggleItem>
                      </S.TemplateTypeToggle>
                    )}
                  />
              </S.SectionHeader>
               <S.StyledCardBody>
                  <S.TemplateSelectorWrapper>
                    <S.TemplateLabel variant="caption" weight="bold" color="text.secondary">
                        {t('listingSettingsGroup.activeTemplate')}
                    </S.TemplateLabel>
                     <Controller
                        name="templates.predefinedTemplateId"
                        control={control}
                        render={({ field }) => (
                           <Select
                             placeholder={t('listingSettingsGroup.selectTemplate')}
                             options={predefinedTemplates.map((tmp: PredefinedTemplateResponse) => ({ value: tmp.id, label: tmp.name }))}
                             value={field.value || ''}
                             onChange={field.onChange}
                             fullWidth
                             disabled={watchedValues.templates.type === 'custom'}
                           />
                        )}
                     />
                  </S.TemplateSelectorWrapper>
                  
                  <S.TemplateEditorContainer>

                    <S.EditorCodeArea>
                        {watchedValues.templates.type === 'custom' ? (
                           <S.CustomTemplateTextarea
                              {...control.register('templates.customTemplateHtml')}
                              placeholder={t('listingSettingsGroup.templatePlaceholder')}
                           />
                        ) : (
                           <S.PredefinedTemplateWrapper>
                              <S.CustomTemplateTextarea
                                readOnly
                                value={activeTemplate.htmlContent}
                              />
                           </S.PredefinedTemplateWrapper>
                        )}
                    </S.EditorCodeArea>
                  </S.TemplateEditorContainer>
               </S.StyledCardBody>
           </S.TemplateSettingsCard>

           {/* Live Preview */}
           <S.PreviewCard variant="bordered">
              <S.LivePreviewHeader>
                 <S.SectionTitleWrapper>
                    <S.HeaderIconWrapper>
                       <Icon name="eye" size={20} />
                    </S.HeaderIconWrapper>
                    <Text variant="h4" weight="bold">{t('listingSettingsGroup.livePreview')}</Text>
                 </S.SectionTitleWrapper>

                 <S.DeviceControls>
                   <S.IconButton 
                     type="button" 
                     $active={previewDevice === 'desktop'} 
                     onClick={() => setPreviewDevice('desktop')}
                   >
                     <Icon name="monitor" size={16} />
                   </S.IconButton>
                   <S.IconButton 
                     type="button"
                     $active={previewDevice === 'tablet'}
                     onClick={() => setPreviewDevice('tablet')}
                   >
                     <Icon name="tablet" size={16} />
                   </S.IconButton>
                   <S.IconButton 
                     type="button"
                     $active={previewDevice === 'mobile'}
                     onClick={() => setPreviewDevice('mobile')}
                   >
                     <Icon name="smartphone" size={16} />
                   </S.IconButton>
                  </S.DeviceControls>
               </S.LivePreviewHeader>
              <CardBody>
                 <S.PreviewCardContent>
                    {renderPreviewContent()}
                 </S.PreviewCardContent>
              </CardBody>
           </S.PreviewCard>
        </S.SplitGrid>
      </S.FormContainer>

      {/* Mobile Preview Modal - Keep existing if needed, though split grid usually hides this on desktop */}

    </S.Container>
  );
};

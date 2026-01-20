import { type ListingSettingsGroupFormData, type PredefinedTemplateResponse } from '@repo/shared';
import { Button, CardBody, Icon, Select, Text, TextInput } from '@repo/ui';
import { Controller } from 'react-hook-form';
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
  form,
  fields,
  append,
  remove,
  onAddRange,
  previewDevice,
  setPreviewDevice,
  renderedPreview,
  getPreviewWidth,
  activeTemplate,
}: ListingSettingsGroupFormProps) => {
  const { t } = useTranslation('listingSettingsGroup');

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch
  } = form;

  const watchedValues = watch(); // We still need watch for dynamic UI updates based on values


  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text variant="caption" color="text.tertiary" style={{ fontSize: 11, fontWeight: 500 }}>{t('translation:menu.settings')}</Text>
            <Icon name="chevron-right" size={14} style={{ color: '#CBD5E1' }} />
            <Text variant="caption" color="text.secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('listingSettingsGroup.editorTitle')}
            </Text>
          </div>
          <S.PageTitle>
            {t('listingSettingsGroup.editorTitle')}
          </S.PageTitle>
          <Text color="text.secondary">
            {t('listingSettingsGroup.editorDescription')}
          </Text>
        </S.HeaderContent>
        <S.Actions>
          <Button variant="secondary" size="md" onClick={onCancel}>
            {t('translation:common.cancel')}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit(onSubmit)} isLoading={isLoading}>
            <Icon name="save" size={18} />
            {t('listingSettingsGroup.saveChanges')}
          </Button>
        </S.Actions>
      </S.Header>

      <S.FormContainer onSubmit={handleSubmit(onSubmit)}>
        {/* General Settings */}
        <S.StyledCard variant="bordered">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="general">
              <Icon name="settings" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('listingSettingsGroup.generalSettings')}</S.SectionTitle>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.InputGrid columns={3}>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.groupName')}</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="name"
                    control={control}
                    label=""
                    placeholder="e.g. Electronics Premium"
                  />
                </S.InputGroup>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.description')}</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="description"
                    control={control}
                    label=""
                    placeholder="Write description..."
                  />
                </S.InputGroup>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.defaultStockQuantity')}</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="stock.defaultQuantity"
                    control={control}
                    label=""
                    type="number"
                  />
                </S.InputGroup>
              </S.InputGrid>
            </S.PaddingContainer>
          </CardBody>
        </S.StyledCard>

        {/* Repricing Strategy */}
        <S.StyledCard variant="bordered">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="repricing">
              <Icon name="trending-up" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('listingSettingsGroup.pricingStrategy')}</S.SectionTitle>
            </S.SectionTitleContent>
            <S.AddButton type="button" onClick={onAddRange}>
              <Icon name="plus" size={14} />
              {t('listingSettingsGroup.addRange')}
            </S.AddButton>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.PriceRangesContainer>
                {fields.map((field, index) => (
                  <S.PriceRangeRow key={field.id}>
                    {index > 0 && (
                      <S.RemoveButton type="button" onClick={() => remove(index)}>
                        <Icon name="x" size={14} />
                      </S.RemoveButton>
                    )}
                    <S.InputGrid columns={4}>
                      <S.InputGroup>
                        <S.InputLabel>{t('listingSettingsGroup.minPrice')} ($)</S.InputLabel>
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.minPrice`}
                          control={control}
                          label=""
                          type="number"
                        />
                      </S.InputGroup>
                      <S.InputGroup>
                        <S.InputLabel>{t('listingSettingsGroup.maxPrice')} ($)</S.InputLabel>
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.maxPrice`}
                          control={control}
                          label=""
                          type="number"
                        />
                      </S.InputGroup>
                      <S.InputGroup>
                        <S.InputLabel>{t('listingSettingsGroup.profitMargin')} (%)</S.InputLabel>
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.profitMarginPercent`}
                          control={control}
                          label=""
                          type="number"
                        />
                      </S.InputGroup>
                      <S.InputGroup>
                        <S.InputLabel>{t('listingSettingsGroup.fixedProfit')} ($)</S.InputLabel>
                        <TextInput<ListingSettingsGroupFormData>
                          name={`repricingStrategy.${index}.fixedProfitAmount`}
                          control={control}
                          label=""
                          type="number"
                          placeholder="0.00"
                        />
                      </S.InputGroup>
                    </S.InputGrid>
                  </S.PriceRangeRow>
                ))}
              </S.PriceRangesContainer>
            </S.PaddingContainer>
          </CardBody>
        </S.StyledCard>

        {/* Fees & Taxes */}
        <S.StyledCard variant="bordered">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="fees">
              <Icon name="percent" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle>{t('listingSettingsGroup.feesAndTaxes')}</S.SectionTitle>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.InputGrid columns={3}>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.ebayFeePercent')} (%)</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="fees.ebayFeePercent"
                    control={control}
                    label=""
                    type="number"
                  />
                </S.InputGroup>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.fixedFeeAmount')} ($)</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="fees.fixedFeeAmount"
                    control={control}
                    label=""
                    type="number"
                  />
                </S.InputGroup>
                <S.InputGroup>
                  <S.InputLabel>{t('listingSettingsGroup.taxRate')} (%)</S.InputLabel>
                  <TextInput<ListingSettingsGroupFormData>
                    name="fees.taxPercent"
                    control={control}
                    label=""
                    type="number"
                  />
                </S.InputGroup>
              </S.InputGrid>
            </S.PaddingContainer>
          </CardBody>
        </S.StyledCard>

        {/* Split View: Template & Preview */}
        <S.SplitGrid>
          {/* HTML Template */}
          <S.TemplateSettingsCard variant="bordered">
            <S.SectionHeader>
              <S.HeaderIconWrapper $type="template">
                <Icon name="code" size={20} />
              </S.HeaderIconWrapper>
              <S.SectionTitleContent>
                <S.SectionTitle>{t('listingSettingsGroup.htmlTemplate')}</S.SectionTitle>
              </S.SectionTitleContent>
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
            <CardBody>
              <S.PaddingContainer style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <S.TemplateSelectorWrapper>
                  <S.InputLabel>{t('listingSettingsGroup.activeTemplate')}</S.InputLabel>
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
                    <div style={{ color: '#64748b', marginBottom: 8, fontSize: 11 }}>&lt;!-- Listing Template --&gt;</div>
                    {watchedValues.templates.type === 'custom' ? (
                      <S.CustomTemplateTextarea
                        {...control.register('templates.customTemplateHtml')}
                        placeholder={t('listingSettingsGroup.templatePlaceholder')}
                      />
                    ) : (
                      <S.CustomTemplateTextarea
                        readOnly
                        value={activeTemplate.htmlContent}
                      />
                    )}
                  </S.EditorCodeArea>
                </S.TemplateEditorContainer>
              </S.PaddingContainer>
            </CardBody>
          </S.TemplateSettingsCard>

          {/* Live Preview */}
          <S.PreviewCard variant="bordered">
            <S.SectionHeader>
              <S.HeaderIconWrapper $type="preview">
                <Icon name="eye" size={20} />
              </S.HeaderIconWrapper>
              <S.SectionTitleContent>
                <S.SectionTitle>{t('listingSettingsGroup.livePreview')}</S.SectionTitle>
              </S.SectionTitleContent>
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
            </S.SectionHeader>
            <CardBody>
              <S.PaddingContainer style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <S.PreviewContainer>
                  <S.PreviewBrowserHeader>
                    <S.BrowserDot />
                    <S.BrowserDot />
                    <S.BrowserDot />
                  </S.PreviewBrowserHeader>
                  <S.PreviewViewport $device={previewDevice}>
                    <S.PreviewContent $width={getPreviewWidth()}>
                      <S.PreviewHTMLContent dangerouslySetInnerHTML={{ __html: renderedPreview }} />
                    </S.PreviewContent>
                  </S.PreviewViewport>
                </S.PreviewContainer>
              </S.PaddingContainer>
            </CardBody>
          </S.PreviewCard>
        </S.SplitGrid>
      </S.FormContainer>
    </S.Container>
  );
};

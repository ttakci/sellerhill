import { TemplateType, type ListingSettingsGroupFormData, type PredefinedTemplateResponse } from '@repo/shared';
import { Button, CardBody, Icon, ModernSelect, ModernTextInput, Text } from '@repo/ui';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './ListingSettingsGroupForm.style';
import { ListingSettingsGroupFormProps } from './ListingSettingsGroupForm.types';

const blockNonNumeric = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {e.preventDefault();}
};

export const ListingSettingsGroupFormComponent = ({
  predefinedTemplates,
  onSubmit,
  onCancel,
  isLoading,
  form,
  fields,
  remove,
  onAddRange,
  previewDevice,
  setPreviewDevice,
  renderedPreview,
  getPreviewWidth,
  activeTemplate,
  onOpenPreview,
}: ListingSettingsGroupFormProps) => {
  const { t } = useTranslation('listingSettingsGroup');

  const { control, handleSubmit, watch } = form;

  const watchedValues = watch();

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle variant="h1" weight="bold">
            {t('listingSettingsGroup.editorTitle')}
          </S.PageTitle>
          <Text color="text.secondary">{t('listingSettingsGroup.editorDescription')}</Text>
        </S.HeaderContent>
      </S.Header>

      <S.FormContainer
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)();
        }}
      >
        {/* General Settings */}
        <S.StyledCard variant="bordered">
          <S.SectionHeader>
            <S.HeaderIconWrapper $type="general">
              <Icon name="settings" size={20} />
            </S.HeaderIconWrapper>
            <S.SectionTitleContent>
              <S.SectionTitle variant="h3" weight="bold">
                {t('listingSettingsGroup.generalSettings')}
              </S.SectionTitle>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.InputGrid columns={4}>
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="name"
                  control={control}
                  label={t('listingSettingsGroup.groupName')}
                  fullWidth
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="description"
                  control={control}
                  label={t('listingSettingsGroup.description')}
                  fullWidth
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="stock.defaultQuantity"
                  control={control}
                  label={t('listingSettingsGroup.defaultStockQuantity')}
                  type="number"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="stock.stockBuffer"
                  control={control}
                  label={t('listingSettingsGroup.stockBuffer')}
                  type="number"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
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
              <S.SectionTitle variant="h3" weight="bold">
                {t('listingSettingsGroup.pricingStrategy')}
              </S.SectionTitle>
            </S.SectionTitleContent>
            <Button variant="primary" size="small" type="button" onClick={onAddRange}>
              <Text>{t('listingSettingsGroup.addRange')}</Text>
            </Button>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.PriceRangesContainer>
                {fields.map((field, index) => (
                  <S.PriceRangeRow key={field.id}>
                    <S.RemoveButton variant="danger" type="button" onClick={() => remove(index)}>
                      <Icon name="x" size={14} />
                    </S.RemoveButton>
                    <S.InputGrid columns={4}>
                      <ModernTextInput<ListingSettingsGroupFormData>
                        name={`repricingStrategy.${index}.minPrice`}
                        control={control}
                        label={t('listingSettingsGroup.minPrice')}
                        type="number"
                        suffixText="$"
                        fullWidth
                        onKeyDown={blockNonNumeric}
                      />
                      <ModernTextInput<ListingSettingsGroupFormData>
                        name={`repricingStrategy.${index}.maxPrice`}
                        control={control}
                        label={t('listingSettingsGroup.maxPrice')}
                        type="number"
                        suffixText="$"
                        fullWidth
                        onKeyDown={blockNonNumeric}
                      />
                      <ModernTextInput<ListingSettingsGroupFormData>
                        name={`repricingStrategy.${index}.profitMarginPercent`}
                        control={control}
                        label={t('listingSettingsGroup.profitMargin')}
                        type="number"
                        suffixText="%"
                        fullWidth
                        onKeyDown={blockNonNumeric}
                      />
                      <ModernTextInput<ListingSettingsGroupFormData>
                        name={`repricingStrategy.${index}.fixedProfitAmount`}
                        control={control}
                        label={t('listingSettingsGroup.fixedProfit')}
                        type="number"
                        suffixText="$"
                        fullWidth
                        onKeyDown={blockNonNumeric}
                      />
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
              <S.SectionTitle variant="h3" weight="bold">
                {t('listingSettingsGroup.feesAndTaxes')}
              </S.SectionTitle>
            </S.SectionTitleContent>
          </S.SectionHeader>
          <CardBody>
            <S.PaddingContainer>
              <S.InputGrid columns={3}>
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="fees.ebayFeePercent"
                  control={control}
                  label={t('listingSettingsGroup.ebayFeePercent')}
                  type="number"
                  suffixText="%"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="fees.fixedFeeAmount"
                  control={control}
                  label={t('listingSettingsGroup.fixedFeeAmount')}
                  type="number"
                  suffixText="$"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name="fees.taxPercent"
                  control={control}
                  label={t('listingSettingsGroup.taxRate')}
                  type="number"
                  suffixText="%"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
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
                <S.SectionTitle variant="h3" weight="bold">
                  {t('listingSettingsGroup.htmlTemplate')}
                </S.SectionTitle>
              </S.SectionTitleContent>
              <Controller
                name="templates.type"
                control={control}
                render={({ field }) => (
                  <S.TemplateTypeToggle>
                    <S.ToggleItem
                      type="button"
                      variant="text"
                      active={field.value === TemplateType.CUSTOM}
                      onClick={() => field.onChange('custom')}
                    >
                      {t('listingSettingsGroup.custom')}
                    </S.ToggleItem>
                    <S.ToggleItem
                      type="button"
                      variant="text"
                      active={field.value === TemplateType.PREDEFINED}
                      onClick={() => field.onChange('predefined')}
                    >
                      {t('listingSettingsGroup.predefined')}
                    </S.ToggleItem>
                  </S.TemplateTypeToggle>
                )}
              />
            </S.SectionHeader>
            <S.TemplateBody>
              <S.TemplateSelectWrapper>
                <ModernSelect<ListingSettingsGroupFormData>
                  name="templates.predefinedTemplateId"
                  control={control}
                  label={t('listingSettingsGroup.activeTemplate')}
                  options={predefinedTemplates.map((tmp: PredefinedTemplateResponse) => ({
                    value: tmp.id,
                    label: tmp.name,
                  }))}
                  fullWidth
                  isDisabled={watchedValues.templates.type === TemplateType.CUSTOM}
                  searchPlaceholder={t('translation:common.search')}
                  noResultsMessage={t('translation:common.noResults')}
                />
              </S.TemplateSelectWrapper>
              <S.CustomTemplateTextarea
                {...(watchedValues.templates.type === TemplateType.CUSTOM
                  ? control.register('templates.customTemplateHtml')
                  : {})}
                readOnly={watchedValues.templates.type !== TemplateType.CUSTOM}
                value={watchedValues.templates.type === TemplateType.CUSTOM ? undefined : activeTemplate.htmlContent}
              />
            </S.TemplateBody>
          </S.TemplateSettingsCard>

          {/* Live Preview */}
          <S.PreviewCard variant="bordered">
            <S.SectionHeader>
              <S.HeaderIconWrapper $type="preview">
                <Icon name="eye" size={20} />
              </S.HeaderIconWrapper>
              <S.SectionTitleContent>
                <S.SectionTitle variant="h3" weight="bold">
                  {t('listingSettingsGroup.livePreview')}
                </S.SectionTitle>
              </S.SectionTitleContent>
              <S.DeviceControls>
                <S.IconButton type="button" variant="ghost" onClick={onOpenPreview}>
                  <Icon name="external-link" size={16} />
                </S.IconButton>
                <S.IconButton
                  type="button"
                  variant="ghost"
                  $active={previewDevice === 'desktop'}
                  onClick={() => setPreviewDevice('desktop')}
                >
                  <Icon name="monitor" size={16} />
                </S.IconButton>
                <S.IconButton
                  type="button"
                  variant="ghost"
                  $active={previewDevice === 'tablet'}
                  onClick={() => setPreviewDevice('tablet')}
                >
                  <Icon name="tablet" size={16} />
                </S.IconButton>
                <S.IconButton
                  type="button"
                  variant="ghost"
                  $active={previewDevice === 'mobile'}
                  onClick={() => setPreviewDevice('mobile')}
                >
                  <Icon name="smartphone" size={16} />
                </S.IconButton>
              </S.DeviceControls>
            </S.SectionHeader>
            <CardBody>
              <S.PaddingContainer $flex>
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

        <S.Actions>
          <Button variant="danger" size="large" onClick={onCancel}>
            <Text>{t('translation:common.cancel')}</Text>
          </Button>
          <Button
            variant="primary"
            size="large"
            onClick={() => {
              void handleSubmit(onSubmit)();
            }}
            isLoading={isLoading}
          >
            <Text>{t('translation:common.save')}</Text>
          </Button>
        </S.Actions>
      </S.FormContainer>
    </S.Container>
  );
};

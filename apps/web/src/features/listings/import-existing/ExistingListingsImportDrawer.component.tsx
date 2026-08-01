import { Button, Drawer, FilePicker, Select, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './ExistingListingsImportDrawer.style';
import type { ExistingListingsImportDrawerComponentProps } from './ExistingListingsImportDrawer.types';

export const ExistingListingsImportDrawerComponent = (props: ExistingListingsImportDrawerComponentProps) => {
  const { t } = useTranslation(['listings', 'translation']);
  const select = (name: string, label: string, options: Array<{ value: string; label: string }>) => (
    <Select value={props.values[name] ?? ''} onChange={(value) => props.onValueChange(name, value)} options={options} label={label} fullWidth />
  );
  return (
    <Drawer isOpen={props.isOpen} onClose={props.onClose} onBack={props.onBack} title={t('listings.existingImport.title')} size="lg"
      primaryAction={{ label: props.step === 0 ? t('translation:common.continue') : t('listings.existingImport.start'), onClick: props.step === 0 ? props.onNext : props.onSubmit, disabled: !props.canProceed || props.isLoading, isLoading: props.isLoading }}>
      <S.Stack>
        {props.step === 0 ? <>
          <S.Panel padding="lg"><Text variant="h4" weight="semibold">{t('listings.existingImport.storeTitle')}</Text>
            {select('ebayAccountId', t('listings.existingImport.store'), props.stores)}</S.Panel>
          <S.Panel padding="lg"><Text variant="h4" weight="semibold">{t('listings.listingSettings.title')}</Text>
            {select('listingSettingsGroupId', t('listings.listingSettings.strategyGroup'), props.groups.map((group) => ({ value: group.id, label: group.name })))}</S.Panel>
          <S.Panel padding="lg"><Text variant="h4" weight="semibold">{t('listings.businessPolicies.title')}</Text><S.Grid>
            {select('paymentPolicyId', t('listings.businessPolicies.paymentPolicy'), props.policies.payment.map((p) => ({ value: p.id, label: p.name })))}
            {select('shippingPolicyId', t('listings.businessPolicies.shippingPolicy'), props.policies.shipping.map((p) => ({ value: p.id, label: p.name })))}
            {select('returnPolicyId', t('listings.businessPolicies.returnPolicy'), props.policies.return.map((p) => ({ value: p.id, label: p.name })))}
          </S.Grid></S.Panel>
        </> : <S.Panel padding="lg">
          <Text variant="h4" weight="semibold">{t('listings.existingImport.fileTitle')}</Text>
          <Text variant="body-sm" color="text.secondary">{t('listings.existingImport.fileHint')}</Text>
          <S.Actions><Button variant="secondary" onClick={props.onDownloadTemplate}><Text>{t('listings.existingImport.downloadTemplate')}</Text></Button></S.Actions>
          <FilePicker accept=".xlsx" fileName={props.fileName} label={t('listings.existingImport.chooseFile')} hint={t('listings.existingImport.xlsxOnly')} onChange={props.onFileChange} />
        </S.Panel>}
      </S.Stack>
    </Drawer>
  );
};

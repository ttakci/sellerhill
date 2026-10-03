import { PolicyType } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDownloadListingImportTemplateMutation, useGetBusinessPoliciesQuery, useImportExistingListingsMutation, useSyncEbayListingsMutation } from '../api/listings.api';

import { ExistingListingsImportDrawerComponent } from './ExistingListingsImportDrawer.component';
import type { ExistingListingsImportDrawerProps } from './ExistingListingsImportDrawer.types';

import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getStoreLabel } from '@/features/ebay/utils/storeLabel';
import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';

const EMPTY = { listingSettingsGroupId: '', paymentPolicyId: '', shippingPolicyId: '', returnPolicyId: '' };
export const ExistingListingsImportDrawer = ({ isOpen, onClose, onSuccess }: ExistingListingsImportDrawerProps) => {
  const { t } = useTranslation(['listings', 'translation']); const { showMessage } = useUI();
  const [step, setStep] = useState<0 | 1>(0); const [file, setFile] = useState<File>(); const [choices, setChoices] = useState(EMPTY);
  // The import goes into the ACTIVE store (top bar). A store switch drops the
  // policy choices: another store's ids would be refused by eBay.
  const { activeStoreId } = useActiveStore();
  const [choicesStore, setChoicesStore] = useState(activeStoreId);
  if (choicesStore !== activeStoreId) { setChoicesStore(activeStoreId); setChoices((current) => ({ ...current, paymentPolicyId: '', shippingPolicyId: '', returnPolicyId: '' })); }
  const values = useMemo(() => ({ ...choices, ebayAccountId: activeStoreId ?? '' }), [choices, activeStoreId]);
  const { data: accounts } = useGetEbayAccountsQuery(); const { data: groups = [] } = useGetListingSettingsGroupsQuery();
  // Policy ids belong to one store: read the active store's.
  const { currentData: policyRows = [] } = useGetBusinessPoliciesQuery(values.ebayAccountId || undefined, { skip: !values.ebayAccountId });
  const [sync, syncState] = useSyncEbayListingsMutation(); const [download] = useDownloadListingImportTemplateMutation();
  const [importFile, importState] = useImportExistingListingsMutation();
  const busy = syncState.isLoading || importState.isLoading; useLoading(busy);
  const policies = useMemo(() => ({ payment: policyRows.filter((p) => p.type === PolicyType.PAYMENT), shipping: policyRows.filter((p) => p.type === PolicyType.SHIPPING), return: policyRows.filter((p) => p.type === PolicyType.RETURN) }), [policyRows]);
  const canProceed = step === 0 ? Object.values(values).every(Boolean) : Boolean(file);
  const change = (name: string, value: string | number) => setChoices((current) => ({ ...current, [name]: String(value) }));
  const next = async () => { if (!canProceed) {return;} try { await sync(values.ebayAccountId).unwrap(); setStep(1); } catch { showMessage({ type: 'error', headerKey: 'translation:message.error.header', descriptionKey: 'listings:listings.existingImport.syncFailed' }, t); } };
  const template = async () => { const blob = await download().unwrap(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sellerhill-listing-import.xlsx'; anchor.click(); URL.revokeObjectURL(url); };
  const submit = async () => { if (!file) {return;} const body = new FormData(); body.append('file', file); Object.entries(values).forEach(([key, value]) => body.append(key, value)); try { const result = await importFile(body).unwrap(); onClose(); onSuccess(result.jobId); } catch { showMessage({ type: 'error', headerKey: 'translation:message.error.header', descriptionKey: 'listings:listings.existingImport.importFailed' }, t); } };
  return <ExistingListingsImportDrawerComponent isOpen={isOpen} step={step} isLoading={busy} canProceed={canProceed} fileName={file?.name} storeLabel={(() => { const store = (accounts?.items ?? []).find((a) => a.id === activeStoreId); return store ? getStoreLabel(store) : ''; })()} groups={groups} policies={policies} values={values} onValueChange={change} onFileChange={(event) => setFile(event.target.files?.[0])} onDownloadTemplate={() => void template()} onNext={() => void next()} onBack={() => step ? setStep(0) : onClose()} onSubmit={() => void submit()} onClose={onClose} />;
};

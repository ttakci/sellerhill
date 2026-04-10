import { Button, Modal, ModernTextInput } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { amazonDetailsSchema } from '@repo/shared';
import * as S from '../OrderDetailsPage.style';

interface AmazonValues {
  amazonOrderUrl?: string;
  amazonTrackingUrl?: string;
  amazonTax?: number;
  amazonShipping?: number;
}

interface AmazonDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: AmazonValues) => void;
  isLoading?: boolean;
}

export const AmazonDetailsModal: React.FC<AmazonDetailsModalProps> = ({ isOpen, onClose, onSave, isLoading }) => {
  const { t } = useTranslation(['orders', 'translation']);
  const [values, setValues] = useState<AmazonValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof AmazonValues, value: string | number) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSave = () => {
    const result = amazonDetailsSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]?.toString();
        if (field) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    onSave(result.data as AmazonValues);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.modal.title')}
      footer={
        <S.ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('orders.modal.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isLoading} disabled={!values.amazonOrderUrl}>
            {t('orders.modal.save')}
          </Button>
        </S.ModalFooter>
      }
    >
      <S.ModalBody>
        <S.FormGroup>
          <S.FormLabel variant="h5">{t('orders.modal.amazonUrl')}</S.FormLabel>
          <ModernTextInput
            name="amazonOrderUrl"
            placeholder={t('orders.modal.amazonUrlPlaceholder')}
            value={values.amazonOrderUrl ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('amazonOrderUrl', e.target.value)}
            fullWidth
          />
          {errors.amazonOrderUrl && <S.ErrorText variant="caption" color="semantic.error">{errors.amazonOrderUrl}</S.ErrorText>}
        </S.FormGroup>
        <S.FormGroup>
          <S.FormLabel variant="h5">{t('orders.modal.trackingUrl')}</S.FormLabel>
          <ModernTextInput
            name="amazonTrackingUrl"
            placeholder={t('orders.modal.trackingUrlPlaceholder')}
            value={values.amazonTrackingUrl ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('amazonTrackingUrl', e.target.value)}
            fullWidth
          />
          {errors.amazonTrackingUrl && <S.ErrorText variant="caption" color="semantic.error">{errors.amazonTrackingUrl}</S.ErrorText>}
        </S.FormGroup>
        <S.FormRow>
          <S.FormGroup>
            <S.FormLabel variant="h5">{t('orders.modal.taxAmount')}</S.FormLabel>
            <ModernTextInput
              name="amazonTax"
              type="number"
              placeholder="0.00"
              value={values.amazonTax?.toString() ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('amazonTax', parseFloat(e.target.value))}
              fullWidth
            />
            {errors.amazonTax && <S.ErrorText variant="caption" color="semantic.error">{errors.amazonTax}</S.ErrorText>}
          </S.FormGroup>
          <S.FormGroup>
            <S.FormLabel variant="h5">{t('orders.modal.shippingCost')}</S.FormLabel>
            <ModernTextInput
              name="amazonShipping"
              type="number"
              placeholder="0.00"
              value={values.amazonShipping?.toString() ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('amazonShipping', parseFloat(e.target.value))
              }
              fullWidth
            />
            {errors.amazonShipping && <S.ErrorText variant="caption" color="semantic.error">{errors.amazonShipping}</S.ErrorText>}
          </S.FormGroup>
        </S.FormRow>
        <S.InfoText>{t('orders.modal.infoText')}</S.InfoText>
      </S.ModalBody>
    </Modal>
  );
};

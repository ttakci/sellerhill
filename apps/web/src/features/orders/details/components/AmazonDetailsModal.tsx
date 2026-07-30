import { amazonDetailsSchema } from '@repo/shared';
import { Dialog, ModernTextInput } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

export const AmazonDetailsModal: React.FC<AmazonDetailsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isLoading,
}) => {
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
        if (field) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    onSave(result.data as AmazonValues);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      type="info"
      title={t('orders.modal.title')}
      description={t('orders.modal.infoText')}
      primaryAction={{
        label: t('orders.modal.save'),
        onClick: handleSave,
        variant: 'primary',
        isLoading: Boolean(isLoading),
        disabled: !values.amazonOrderUrl || Boolean(isLoading),
      }}
      secondaryAction={{
        label: t('orders.modal.cancel'),
        onClick: onClose,
        variant: 'secondary',
        disabled: Boolean(isLoading),
      }}
    >
      <S.ModalBody>
        <S.FormGroup>
          <ModernTextInput
            name="amazonOrderUrl"
            label={t('orders.modal.amazonUrl')}
            placeholder={t('orders.modal.amazonUrlPlaceholder')}
            value={values.amazonOrderUrl ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange('amazonOrderUrl', e.target.value)
            }
            fullWidth
          />
          {errors.amazonOrderUrl ? <S.ErrorText variant="caption" color="semantic.error">{errors.amazonOrderUrl}</S.ErrorText> : null}
        </S.FormGroup>
        <S.FormGroup>
          <ModernTextInput
            name="amazonTrackingUrl"
            label={t('orders.modal.trackingUrl')}
            placeholder={t('orders.modal.trackingUrlPlaceholder')}
            value={values.amazonTrackingUrl ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange('amazonTrackingUrl', e.target.value)
            }
            fullWidth
          />
          {errors.amazonTrackingUrl ? <S.ErrorText variant="caption" color="semantic.error">{errors.amazonTrackingUrl}</S.ErrorText> : null}
        </S.FormGroup>
        <S.FormRow>
          <S.FormGroup>
            <ModernTextInput
              name="amazonTax"
              label={t('orders.modal.taxAmount')}
              type="number"
              placeholder="0.00"
              value={values.amazonTax?.toString() ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('amazonTax', parseFloat(e.target.value))
              }
              fullWidth
            />
            {errors.amazonTax ? <S.ErrorText variant="caption" color="semantic.error">{errors.amazonTax}</S.ErrorText> : null}
          </S.FormGroup>
          <S.FormGroup>
            <ModernTextInput
              name="amazonShipping"
              label={t('orders.modal.shippingCost')}
              type="number"
              placeholder="0.00"
              value={values.amazonShipping?.toString() ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('amazonShipping', parseFloat(e.target.value))
              }
              fullWidth
            />
            {errors.amazonShipping ? <S.ErrorText variant="caption" color="semantic.error">{errors.amazonShipping}</S.ErrorText> : null}
          </S.FormGroup>
        </S.FormRow>
      </S.ModalBody>
    </Dialog>
  );
};

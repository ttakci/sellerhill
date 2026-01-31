import { Button, Input, Modal } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const handleChange = (field: keyof AmazonValues, value: string | number) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modal.title')}
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {t('modal.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave(values)}
            isLoading={isLoading}
            disabled={!values.amazonOrderUrl}
          >
            {t('modal.save')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
              display: 'block',
            }}
          >
            {t('modal.amazonUrl')}
          </label>
          <Input
            placeholder={t('modal.amazonUrlPlaceholder')}
            value={values.amazonOrderUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('amazonOrderUrl', e.target.value)}
            fullWidth
          />
        </div>
        <div>
          <label
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
              display: 'block',
            }}
          >
            {t('modal.trackingUrl')}
          </label>
          <Input
            placeholder={t('modal.trackingUrlPlaceholder')}
            value={values.amazonTrackingUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('amazonTrackingUrl', e.target.value)}
            fullWidth
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.375rem',
                display: 'block',
              }}
            >
              {t('modal.taxAmount')}
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={values.amazonTax?.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('amazonTax', parseFloat(e.target.value))
              }
              fullWidth
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.375rem',
                display: 'block',
              }}
            >
              {t('modal.shippingCost')}
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={values.amazonShipping?.toString()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange('amazonShipping', parseFloat(e.target.value))
              }
              fullWidth
            />
          </div>
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.5rem' }}>{t('modal.infoText')}</div>
      </div>
    </Modal>
  );
};

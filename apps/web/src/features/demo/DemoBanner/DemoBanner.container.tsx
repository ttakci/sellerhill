import { useUI } from '@repo/ui';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DEMO_READONLY_EVENT } from '../demoBaseQuery';
import { exitDemoMode, isDemoMode } from '../demoMode';

import { DemoBannerComponent } from './DemoBanner.component';

/**
 * Renders nothing outside demo mode, so it is safe to mount unconditionally at
 * the app root. It also owns the single explanation of a refused write: the
 * demo base query broadcasts one event, this listens for it, and no mutation
 * site anywhere else has to know demo mode exists.
 */
export const DemoBanner: React.FC = () => {
  const { t, i18n } = useTranslation('translation');
  const { showMessage } = useUI();
  const demo = isDemoMode();

  useEffect(() => {
    if (!demo) {
      return undefined;
    }
    const handler = (): void => {
      showMessage(
        {
          type: 'info',
          headerKey: 'translation:demo.readonly.title',
          descriptionKey: 'translation:demo.readonly.message',
        },
        t
      );
    };
    window.addEventListener(DEMO_READONLY_EVENT, handler);
    return () => window.removeEventListener(DEMO_READONLY_EVENT, handler);
  }, [demo, showMessage, t]);

  const locale = (i18n.language || 'en').split('-')[0];

  const handleExit = useCallback(() => {
    exitDemoMode('/');
  }, []);

  const handleSignUp = useCallback(() => {
    exitDemoMode(`/${locale}/register`);
  }, [locale]);

  if (!demo) {
    return null;
  }

  return (
    <DemoBannerComponent
      label={t('translation:demo.banner.label')}
      description={t('translation:demo.banner.description')}
      exitLabel={t('translation:demo.banner.exit')}
      signUpLabel={t('translation:demo.banner.signUp')}
      onExit={handleExit}
      onSignUp={handleSignUp}
    />
  );
};

export default DemoBanner;

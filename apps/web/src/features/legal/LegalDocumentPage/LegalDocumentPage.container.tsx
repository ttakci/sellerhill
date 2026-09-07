import { LegalDocumentKey, type LegalDocument, type SupportedLocale } from '@repo/shared';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { LegalDocumentPageComponent } from './LegalDocumentPage.component';
import type { LegalDocumentPageContainerProps } from './LegalDocumentPage.types';

import { parseLegalDocument } from '@/features/legal/utils/parseLegalDocument';
import { changeLocaleInPath, resolveLocale, storeLocalePreference } from '@/utils/locale';


export const LegalDocumentPageContainer = ({ documentKey }: LegalDocumentPageContainerProps) => {
  const { t, i18n } = useTranslation(['legal']);
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const { locale: localeParam } = useParams<{ locale: string }>();

  const language = i18n.language;
  const currentLocale = resolveLocale(
    localeParam === 'en' || localeParam === 'tr' ? localeParam : null
  );

  /*
   * i18next hands back `unknown` for an object-valued key, so the payload is
   * narrowed rather than cast — see parseLegalDocument for why a malformed
   * resource degrades instead of throwing. `language` is a dependency because
   * the whole document is re-read from the other locale's file when it changes.
   */
  const document = useMemo<LegalDocument | null>(() => {
    void language;
    return parseLegalDocument(t(`legal.${documentKey}`, { returnObjects: true }));
  }, [t, documentKey, language]);

  /*
   * The URL locale is an explicit request for THIS document in THAT language,
   * and it outranks the stored preference — `resolveLocale` already says so.
   * i18next, though, is initialised from localStorage/browser only (see
   * i18n.config.ts), so a visitor whose stored preference is Turkish opening a
   * shared /en/privacy link was served the Turkish document under an English
   * URL. Sync the active language to the segment; deliberately WITHOUT writing
   * the preference, since following one link is not a decision to switch the
   * whole app over.
   */
  useEffect(() => {
    if (language !== currentLocale) {
      void i18n.changeLanguage(currentLocale);
    }
  }, [i18n, language, currentLocale]);

  /*
   * A hash arriving with the initial navigation (the landing footer links
   * straight to #cookies) cannot be honoured by the browser: the document is
   * still rendering when it tries. Re-run once the sections exist.
   */
  useEffect(() => {
    if (!document) {
      return;
    }
    if (!hash) {
      // Arriving from the landing footer keeps that page's scroll offset
      // otherwise, dropping the reader into the middle of the document.
      window.scrollTo({ top: 0 });
      return;
    }
    const target = window.document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, document]);

  const handleLocaleChange = useCallback(
    (locale: SupportedLocale) => {
      storeLocalePreference(locale);
      void i18n.changeLanguage(locale);
      /*
       * The locale also lives in the path, so it has to move with the
       * preference — otherwise a reload would snap the page back to whatever
       * language the URL still names. Derived from the current path rather than
       * rebuilt from the document key, so this keeps working if a document is
       * ever routed under a slug that differs from its key.
       */
      void navigate(`${changeLocaleInPath(pathname, locale)}${hash}`, { replace: true });
    },
    [i18n, navigate, pathname, hash]
  );

  const handleNavigateHome = useCallback(() => {
    void navigate('/');
  }, [navigate]);

  return (
    <LegalDocumentPageComponent
      document={document}
      currentLocale={currentLocale}
      currentYear={new Date().getFullYear()}
      onLocaleChange={handleLocaleChange}
      onNavigateHome={handleNavigateHome}
    />
  );
};

/** Convenience wrappers so the route table does not have to pass the key. */
export const PrivacyPolicyPageContainer = () => (
  <LegalDocumentPageContainer documentKey={LegalDocumentKey.PRIVACY} />
);

export const TermsOfServicePageContainer = () => (
  <LegalDocumentPageContainer documentKey={LegalDocumentKey.TERMS} />
);

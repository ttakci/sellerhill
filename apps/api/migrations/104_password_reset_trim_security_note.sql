-- Operator feedback (2026-09-16) on the password_reset security note: the
-- trailing "— your password will not change" / "— şifreniz değişmeyecektir"
-- clause is unnecessary and is dropped from both locales. The sentence
-- before it ("you can safely ignore this email") already covers the point;
-- restating the specific mechanism read as padding.

UPDATE email_templates
SET
  html_content = replace(
    html_content,
    'If you didn''t request a password reset, you can safely ignore this email — your password will not change.',
    'If you didn''t request a password reset, you can safely ignore this email.'
  )
WHERE template_key = 'password_reset' AND locale = 'en';

UPDATE email_templates
SET
  html_content = replace(
    html_content,
    'Şifre sıfırlama talebinde bulunmadıysanız bu e-postayı güvenle yoksayabilirsiniz — şifreniz değişmeyecektir.',
    'Şifre sıfırlama talebinde bulunmadıysanız bu e-postayı güvenle yoksayabilirsiniz.'
  )
WHERE template_key = 'password_reset' AND locale = 'tr';

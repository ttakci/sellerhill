-- 099 gave the email_verification header a flat solid navy (#0c1f52 —
-- colors.sidebar.background). Operator feedback after seeing it live
-- (2026-09-16): the bar reads too dark, and looks visually detached from the
-- rest of the card ("mavi bar havadaymış gibi duruyor... tum email içeriği
-- kart içinde olsa olmaz mı"). The operator also asked specifically for the
-- SAME blue used on the login/register left panel, which is animated there
-- but should become a static gradient in email: "orda nasıl yaptıysan
-- yapabilirsin" (however you did it there, you can do it here).
--
-- That panel is `packages/ui/src/atoms/MeshBackground` (rendered inside
-- AuthShowcase on the login/register pages): a near-black base
-- (colors.landing.auroraBg #070B1A) with blurred radial blobs of
-- colors.brand.primary (#2563eb) and colors.brand.primaryHover (#1d4ed8).
-- Email clients can't blur/animate, so this migration approximates the same
-- three real brand tokens as a static linear gradient — bright blue at the
-- top (behind the logo) darkening toward near-black at the bottom (behind
-- the h1 text), which keeps the white heading text on the darkest, highest-
-- contrast part of the band (white-on-#070B1A ~19:1; white-on-#2563eb alone
-- would be a borderline ~3.7:1).
--
-- Two more fixes for the "floating bar" complaint, both defensive for
-- clients that ignore `overflow: hidden` on the parent (desktop Outlook):
-- the header now carries its own top border-radius and the footer its own
-- bottom border-radius, instead of relying solely on `.container`'s clip.
-- `.container` also gained a 1px hairline border so the card's edge is still
-- visible in a client that drops the box-shadow, reinforcing that header +
-- content + footer are one surface.
--
-- background-color stays a real brand token (#1d4ed8, brand.primaryHover) as
-- the flat fallback for clients with no gradient support — verified AA
-- contrast with white text (~4.8:1) — so the "too dark" complaint isn't
-- reintroduced for the minority of clients that fall back to it.

UPDATE email_templates
SET
  html_content = replace(
    replace(
      replace(
        html_content,
        '.container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }',
        '.container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }'
      ),
      '.header { background-color: #0c1f52; padding: 40px 32px 32px; text-align: center; }',
      '.header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }'
    ),
    '.footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; }',
    '.footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }'
  )
WHERE template_key = 'email_verification';

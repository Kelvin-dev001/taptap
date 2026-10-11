import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";
import { onAccentColor, resolveTheme, type PublicPage } from "@taptap/core/profile";
import { roleLine } from "@taptap/core/templates";
import { radius, space } from "@/theme/tokens";
import { Text } from "@/ui/text";
import { actionLabel } from "./blocks";
import { BlockIcon } from "./block-icon";

/**
 * A profile drawn natively, the way customers see it on the web
 * (components/profile/profile-view.tsx): photo, name, line under it, about,
 * the actions — the first one filled — and the lead form.
 *
 * Inert on purpose. Nothing opens and nothing is counted: an owner looking at
 * their own profile in the app is not a visit (PLAN.md §15 M4).
 *
 * Colours are the profile's own theme, not the app's, so it looks the same in
 * light and dark mode — it is the business's page.
 */
export function ProfileView({ page }: { page: PublicPage }) {
  const { t } = useTranslation();
  const theme = resolveTheme(page.theme);
  const config = page.config ?? {};
  const onAccent = onAccentColor(theme.accent);
  const role = roleLine(config);
  const blocks = [...(page.links ?? [])]
    .filter((b) => b.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
  const ink = { color: theme.text };

  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      {config.coverUrl ? (
        <Image source={{ uri: config.coverUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={[styles.body, config.coverUrl ? styles.underCover : styles.noCover]}>
        {config.avatarUrl ? (
          <Image
            source={{ uri: config.avatarUrl }}
            style={[styles.avatar, { borderColor: theme.bg }]}
            accessibilityLabel={page.title ?? undefined}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {page.title ? (
          <Text variant="sectionTitle" weight="bold" style={[styles.center, ink]}>
            {page.title}
          </Text>
        ) : null}
        {role ? (
          <Text variant="bodySm" style={[styles.center, ink, styles.soft]}>
            {role}
          </Text>
        ) : null}
        {config.bio ? (
          <Text variant="bodySm" style={[styles.center, ink, styles.softer]}>
            {config.bio}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {blocks.map((block, i) => {
            const primary = i === 0;
            const label = block.label || actionLabel(t, block.type);
            const fg = primary ? onAccent : theme.text;
            return (
              <View
                key={block.id ?? `${block.type}-${i}`}
                style={[
                  styles.action,
                  primary
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { borderColor: withAlpha(theme.text, 0.15) },
                ]}
              >
                <BlockIcon type={block.type} size={16} color={fg} />
                <Text variant="bodySm" weight="medium" numberOfLines={1} style={[styles.actionLabel, { color: fg }]}>
                  {label}
                </Text>
                {block.type === "mpesa" && block.value ? (
                  <Text variant="caption" style={[{ color: fg }, styles.soft]}>
                    {block.value}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {blocks.length === 0 ? (
            <Text variant="bodySm" style={[styles.center, ink, styles.faint]}>
              {t("profileView.noActions")}
            </Text>
          ) : null}
        </View>

        {config.leadForm?.enabled ? (
          <View style={styles.form} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {config.leadForm.headline ? (
              <Text variant="bodySm" weight="medium" style={[styles.center, ink]}>
                {config.leadForm.headline}
              </Text>
            ) : null}
            {[t("profileView.formName"), t("profileView.formPhone"), t("profileView.formEmail")].map((f) => (
              <View key={f} style={[styles.field, { borderColor: withAlpha(theme.text, 0.15) }]}>
                <Text variant="bodySm" style={[ink, styles.faint]}>
                  {f}
                </Text>
              </View>
            ))}
            <View style={[styles.submit, { backgroundColor: theme.accent }]}>
              <Text variant="bodySm" weight="medium" style={{ color: onAccent }}>
                {config.leadForm.buttonLabel || t("profileView.formSend")}
              </Text>
            </View>
          </View>
        ) : null}

        {!page.custom_branding ? (
          <Text variant="caption" style={[styles.center, ink, styles.faint, styles.footer]}>
            {t("profileView.poweredBy")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** `#rrggbb` at an opacity, for the web's `border-current/15`. Anything else passes through. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${m[1]}${a}`;
}

const styles = StyleSheet.create({
  page: { borderRadius: radius.lg, overflow: "hidden" },
  cover: { width: "100%", height: 112 },
  body: { alignItems: "center", gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  noCover: { paddingTop: space.xxxl },
  underCover: { marginTop: -40 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4 },
  center: { textAlign: "center" },
  soft: { opacity: 0.7 },
  softer: { opacity: 0.8 },
  faint: { opacity: 0.55 },
  actions: { alignSelf: "stretch", gap: space.sm + 2, marginTop: space.xs },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  actionLabel: { flex: 1 },
  form: { alignSelf: "stretch", gap: space.sm, marginTop: space.md },
  field: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  submit: { borderRadius: radius.lg, paddingVertical: space.sm + 2, alignItems: "center" },
  footer: { marginTop: space.xl },
});

import type { ThemeTokens } from "@android-initializr/design-tokens";

export interface PreviewScreenProps {
  tokens: ThemeTokens;
  mode: "light" | "dark";
  projectName: string;
  /** Optional caption rendered under the device frame. */
  caption?: string;
}

/**
 * Approximate Material 3 rendering of the generated Compose screen.
 * This is a web simulation, not a Compose runtime: it uses the same resolved
 * tokens but does not reproduce Compose layout or typography exactly.
 */
export function PreviewScreen(props: PreviewScreenProps) {
  const colors = () => (props.mode === "dark" ? props.tokens.dark : props.tokens.light);
  const spacing = () => props.tokens.spacing;
  const card = () => props.tokens.components.card;

  return (
    <figure class="aip-figure">
      <div class="aip-phone" style={{ "background-color": colors().surface }}>
        <div class="aip-status" style={{ color: colors().onSurface }}>
          <span>9:41</span>
          <span class="aip-status-icons" aria-hidden="true">
            <span class="aip-signal" />
            <span class="aip-battery" />
          </span>
        </div>
        <div class="aip-appbar" style={{ "background-color": colors().surface }}>
          <span
            class="aip-appbar-title"
            style={{ color: colors().onSurface }}
            title={props.projectName}
          >
            {props.projectName}
          </span>
        </div>
        <div class="aip-body" style={{ "background-color": colors().background }}>
          <h3
            class="aip-headline"
            style={{ color: colors().primary }}
          >
            {props.projectName}
          </h3>
          <p class="aip-subtitle" style={{ color: colors().onSurfaceVariant }}>
            A native Android app built with Kotlin and Jetpack Compose.
          </p>
          <div
            class="aip-card"
            style={{
              "background-color": colors().surface,
              "border-color": colors().outlineVariant,
              "border-radius": `${card().cornerRadius}px`,
              "box-shadow": card().elevation > 0
                ? `0 ${card().elevation}px ${card().elevation * 3}px rgba(0,0,0,0.18)`
                : "none",
            }}
          >
            <span class="aip-card-title" style={{ color: colors().onSurface }}>
              Your starting point
            </span>
            <span class="aip-card-meta" style={{ color: colors().onSurfaceVariant }}>
              Taps: 0
            </span>
            <span class="aip-card-meta" style={{ color: colors().onSurfaceVariant }}>
              Ready to build.
            </span>
          </div>
          <div
            class="aip-button"
            style={{
              "background-color": colors().primary,
              color: colors().onPrimary,
              "border-radius": `${props.tokens.components.button.cornerRadius}px`,
              "min-height": `${props.tokens.components.button.minHeight}px`,
            }}
          >
            Tap the button
          </div>
          <div class="aip-spacer" style={{ height: `${spacing().xl}px` }} />
          <div class="aip-swatches" aria-label="Material 3 color roles">
            {[
              ["primary", colors().primary],
              ["secondary", colors().secondary],
              ["tertiary", colors().tertiary],
              ["error", colors().error],
              ["surface", colors().surface],
            ].map(([role, value]) => (
              <span
                class="aip-swatch"
                title={`${role}: ${value}`}
                style={{ "background-color": value, "border-color": colors().outlineVariant }}
              />
            ))}
          </div>
        </div>
      </div>
      <figcaption class="aip-caption">
        {props.caption ?? "Material 3 simulation using the generated design tokens."}
      </figcaption>
    </figure>
  );
}

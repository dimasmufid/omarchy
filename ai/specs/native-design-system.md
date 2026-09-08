# Omarchy Mobile Native Design System

Status: Accepted direction; component details remain draft  
Platforms: iOS/iPadOS and Android  
Last updated: 2026-09-08

## 1. Decision

Omarchy Mobile uses React Native and Expo for shared product logic, navigation
state, networking orchestration, and screen composition. Visible interactive
surfaces use a platform-native renderer:

- iOS uses `@expo/ui/swift-ui`, which renders real SwiftUI controls and Liquid
  Glass on supported releases.
- Android uses `@expo/ui/jetpack-compose`, which renders real Jetpack Compose
  Material 3 and Material 3 Expressive components.
- The universal `@expo/ui` layer is preferred when it preserves the desired
  platform behavior from one component tree.

The two renderers share semantic component contracts, not identical pixels.
Omarchy supplies product identity through content, accent, icon meaning, and
interaction priorities. Apple and Android supply platform structure, materials,
motion, haptics, accessibility, and control behavior.

This is not two separate applications. Shared business and protocol behavior
remains in TypeScript and the OmarchyLink native module. Only the presentation
implementation differs.

## 2. Why this boundary

The product should feel native without making the MVP unnecessarily complex.
Wrapping every `Text`, `View`, spacer, and static divider would create a large
bridge API with little user benefit. Using only React Native-styled imitations
would fail to adopt platform materials and interaction behavior.

Therefore:

- native code owns interactive and platform-defining surfaces;
- React Native owns passive composition where platform behavior is not lost;
- operating-system presentations use operating-system APIs;
- platform-neutral semantics are tested once;
- each renderer is visually and behaviorally tested independently.

## 3. Definition of native

A native Omarchy component:

- is backed by a SwiftUI view on iOS or a Jetpack Compose component on Android,
  hosted through Expo UI;
- uses semantic system colors, typography, shapes, animation, and accessibility;
- responds to platform states such as Reduce Motion, Reduce Transparency,
  Dynamic Type/font scale, increased contrast, dark mode, and input modality;
- emits semantic events to React Native;
- does not reproduce a platform effect with JavaScript gradients, blur layers,
  screenshots, SVGs, or CSS-like approximations.

React Native wrappers in `.ios.tsx` and `.android.tsx` are adapters to native
renderers; they are not the final visual implementation.

## 4. Architecture

```text
Shared TypeScript feature
  state · validation · protocol · analytics policy
                       │
               semantic view model
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
  iOS adapter                   Android adapter
        │                             │
  @expo/ui Host                 @expo/ui Host
        │                             │
  SwiftUI renderer              Compose renderer
  Liquid Glass                  Material 3 Expressive
        │                             │
        └──────── semantic events ────┘
                       │
               shared TypeScript intent
```

Native renderers receive display state and emit user intent. They do not call
the network, decide permissions, hold authentication state, or execute actions.

## 5. Module boundaries

### 5.1 `omarchy-link`

Existing native service module:

- discovery and connections;
- secure identities;
- clipboard and share integration;
- platform lifecycle;
- transfer services.

### 5.2 `omarchy-ui`

`omarchy-ui` is the name of the application's thin TypeScript design-system
facade. It is not a separate published dependency and does not reimplement the
native toolkits. Its default implementation is Expo UI (`@expo/ui`):

```text
apps/mobile/src/components/omarchy-ui/
├── index.ts
├── types.ts
├── ActionButton.ios.tsx        # @expo/ui/swift-ui
├── ActionButton.android.tsx    # @expo/ui/jetpack-compose
├── DeviceHeader.ios.tsx
├── DeviceHeader.android.tsx
├── ProgressSurface.ios.tsx
├── ProgressSurface.android.tsx
└── universal/                  # @expo/ui where one native tree is sufficient
```

Every Expo UI tree is wrapped in the appropriate `Host`. Platform-specific
component files live under `src/components`, not Expo Router's `app` route
directory. Routes import the facade without importing an iOS-only module on
Android or an Android-only module on iOS.

Custom Swift/Kotlin or Fabric views are allowed only when a P0 experience cannot
be implemented with `@expo/ui`, a system API, or a simpler interaction. The gap
and maintenance cost must be documented before creating custom native UI.
Keep all UI adapters separate from security-sensitive `omarchy-link` code.

## 6. Semantic API

Platform-neutral types describe meaning rather than appearance:

```ts
type ActionRole = "primary" | "secondary" | "destructive" | "quiet";
type ActionState = "idle" | "pending" | "success" | "disabled";
type StatusTone = "neutral" | "positive" | "warning" | "critical";

interface NativeActionButtonProps {
  id: string;
  label: string;
  systemIcon: SemanticIcon;
  role: ActionRole;
  state: ActionState;
  disabledReason?: string;
  accessibilityHint?: string;
  onPress: (event: { id: string }) => void;
}
```

Forbidden cross-platform props:

- raw blur radius;
- arbitrary RGBA surface colors;
- shadow coordinates;
- corner radius chosen per call site;
- platform font names;
- animation durations for standard interactions;
- raw SF Symbol or Material icon names from a remote provider;
- HTML, CSS, SVG, shader, or platform code.

Call sites choose semantic intent. Each native renderer decides the correct
platform representation.

## 7. iOS renderer

### 7.1 Framework choice

Phase 1 uses `@expo/ui/swift-ui`. Its `Host` embeds real SwiftUI through native
hosting, and its controls and modifiers mirror the SwiftUI API. UIKit remains
available for system integrations or a missing component, but is not the
default component implementation.

Use:

- native navigation stacks and headers through the native-stack integration;
- Expo UI `Button`, `Toggle`, `ProgressView`, `List`, `Section`, `Alert`,
  `ConfirmationDialog`, `Menu`, `BottomSheet`, and layout components;
- Expo UI SwiftUI modifiers including official glass button styles on supported
  iOS and Xcode versions;
- SF Symbols referenced by symbol name inside trusted client code;
- semantic system colors and Dynamic Type text styles;
- SwiftUI accessibility semantics, custom actions, and focus order.

### 7.2 Liquid Glass policy

Liquid Glass is a functional interaction layer, not a background texture.

Use it for:

- primary floating actions;
- navigation and toolbar controls;
- compact action groups above content;
- transient controls related to the current task;
- one visually dominant Home action when appropriate.

Do not use it for:

- every card or list row;
- large reading surfaces;
- content backgrounds;
- decorative blur behind static text;
- nested layers of glass;
- warnings where translucency harms comprehension;
- an attempt to make Android look like iOS.

Implementation requirements:

- Prefer standard Expo UI SwiftUI controls because supported SDK builds adopt
  the current platform appearance automatically.
- Use `buttonStyle('glass')` and `buttonStyle('glassProminent')` for native Expo
  UI button/menu controls on supported builds.
- Use Expo UI's official glass effect and container modifiers only for custom
  SwiftUI compositions that need the interaction layer.
- Use tint to communicate one primary action or selection, not decoration.
- Test over every actual background used by the app.
- Respect Reduce Transparency and Increased Contrast without a hand-built glass
  imitation.

### 7.3 iOS version fallback

On releases without Liquid Glass APIs:

- use standard native buttons, navigation bars, sheets, grouped lists, and
  system materials available on that OS;
- keep semantic hierarchy and Omarchy accent;
- do not reproduce Liquid Glass using layered blur, gradients, or animation;
- guard newer APIs at compile and runtime;
- maintain equivalent accessibility labels, actions, and confirmation behavior.

The fallback is an intentionally native earlier-iOS design, not a degraded copy
of the newest design.

## 8. Android renderer

### 8.1 Framework choice

Use `@expo/ui/jetpack-compose`. Its `Host` contains the native Compose tree.

Use:

- Material 3 components;
- Material 3 Expressive components where stable for the supported dependency and
  API range;
- Android system sheets, dialogs, menus, progress, and permission flows;
- predictive back behavior through the host navigation integration;
- Compose semantics and TalkBack support;
- system font scale, contrast, dark theme, and reduced-motion behavior;
- platform haptics and ripple/state-layer interaction.

Prefer the universal `@expo/ui` component when it already delegates to the
correct native control and no platform-specific modifier or layout is needed.

### 8.2 Android visual policy

- Use Material surface hierarchy rather than copying Liquid Glass.
- Allow Material You dynamic color only when the user enables `Follow system`;
  default Omarchy mode uses the paired desktop accent within a contrast-safe
  Material color scheme.
- Use expressive shape and motion for important actions without making every
  surface animated.
- Use standard top app bar, sheets, switches, progress indicators, and buttons.
- Use edge-to-edge layout and system insets correctly.
- Preserve Android navigation expectations instead of copying iOS toolbar
  placement.

### 8.3 Compose lifecycle

- Let Expo UI own Compose hosting and disposal unless a documented custom native
  component is introduced.
- Treat props as immutable view state.
- Emit events through the native module event contract on the UI thread.
- Cancel native animation and work when the host view detaches.
- Never launch network operations from a composable.
- Avoid creating a separate Compose composition for every trivial text or icon;
  use meaningful compound components.

## 9. Omarchy identity across platforms

Shared product identity comes from:

- the Omarchy name and approved mark;
- concise, direct language;
- the paired desktop's safe display name;
- semantic accent color with platform contrast correction;
- a small trusted semantic icon vocabulary;
- consistent operation names and statuses;
- privacy-forward behavior;
- restrained density and hierarchy.

It does not require identical:

- control shapes;
- navigation placement;
- sheets and dialogs;
- typography metrics;
- motion curves;
- blur or material treatment;
- Android and iOS screenshots.

Platform screenshots should look related, not cloned.

## 10. P0 component inventory

Build only these native component families for Phase 1:

| Semantic component | iOS | Android | Used by |
|---|---|---|---|
| `NativeNavigationChrome` | Native stack plus Expo UI SwiftUI toolbar controls | Expo UI Compose navigation/top app bar | Pairing, Home, Settings |
| `NativeDeviceHeader` | Expo UI SwiftUI surface and status content | Expo UI Compose surface and status content | Home |
| `NativeActionButton` | Expo UI SwiftUI Button with role/glass style | Expo UI Compose Material Button | Home, confirmations |
| `NativeActionGroup` | Expo UI ControlGroup/layout and glass container where appropriate | Expo UI Compose row/button grouping | Home |
| `NativeProgressSurface` | Expo UI ProgressView and Button | Expo UI progress and Button | File send |
| `NativeSettingsRow` | Expo UI List/Section native row | Expo UI ListItem/Material row | Settings |
| `NativeConfirmation` | Expo UI Alert, ConfirmationDialog, or BottomSheet | Expo UI AlertDialog or ModalBottomSheet | Lock, forget, send |
| `NativeStatusMessage` | Expo UI content-unavailable/inline composition | Expo UI Snackbar/inline composition | Errors and result |

QR scanning, system file/photo pickers, share surfaces, clipboard paste controls,
and permission prompts already use native platform APIs and are not recreated in
the design system.

## 11. P1 component inventory

- Native segmented controls or filters.
- Media control and volume surface.
- Native activity list with swipe/context actions.
- Desktop picker for multiple computers.
- Native connection banner for LAN, tailnet, or Cloudflare relay.
- Native theme preference row and preview.
- Platform search field.

## 12. P2 component inventory

- Capability card renderer backed by the declarative capability contract.
- Native widgets and Live Activities.
- Rich transfer/inbox previews.
- Owner-defined forms using a constrained native field vocabulary.
- Long-running action progress and result surfaces.

Third-party capabilities select semantic components. They never choose Liquid
Glass, Material implementation types, colors, raw icons, or custom layout code.

## 13. Screen composition

### 13.1 Pairing

Shared logic owns discovery, QR parsing, pairing states, and errors.

iOS:

- native navigation title and toolbar;
- system camera/QR surface;
- native sheet or alert for desktop confirmation state;
- Liquid Glass limited to floating scan/help actions when supported.

Android:

- Material top app bar;
- system/CameraX-backed QR surface through the selected Expo integration;
- Material bottom sheet or dialog for pairing state;
- native back and permission behavior.

### 13.2 Home

Shared logic supplies device status and four actions.

iOS:

- native navigation chrome;
- content scrolls beneath the functional control layer where appropriate;
- one prominent glass action may represent the current primary task;
- remaining actions use grouped native control hierarchy.

Android:

- edge-to-edge Material scaffold;
- Material 3 status surface and action grouping;
- prominent action follows Material hierarchy rather than glass styling.

### 13.3 Settings

Use native grouped settings/list behavior, switches, destructive rows, and
confirmation presentation. Do not force shared card visuals across platforms.

## 14. State and events

Every native component supports these common states where meaningful:

- enabled;
- pressed/active;
- focused;
- pending;
- success;
- disabled with accessible reason;
- unavailable;
- error.

Rules:

- React Native remains the operation state authority for visible flows.
- Native controls apply immediate pressed/haptic feedback.
- A pending control disables duplicate intent until shared logic resolves it.
- Success animation does not replace a semantic accessibility announcement.
- Native views emit IDs and typed values, never localized display text as
  business identifiers.

## 15. Accessibility

Required on both platforms:

- minimum platform touch target;
- screen-reader name, role, value, state, hint, and action;
- logical focus order;
- large text/font scale without truncating action meaning;
- color-independent status and risk communication;
- reduced-motion behavior;
- increased-contrast behavior;
- switch/button semantics rather than tap-only generic containers;
- accessibility announcement for async completion and failure;
- hardware keyboard focus for tablet use where supported.

Liquid Glass and translucent Material surfaces must pass contrast checks over
the actual content behind them. If they do not, the renderer uses a more opaque
native alternative.

## 16. Performance

- Do not cross the native boundary every animation frame.
- Pass small immutable view models and coarse state changes.
- Keep progress updates at four per second unless user-perceived smoothness
  requires a native interpolated value.
- Native views animate locally between shared-state updates.
- Avoid deeply nested native/React Native view alternation.
- Prefer compound native surfaces over dozens of leaf native views.
- Measure mount, layout, memory, scroll, and accessibility performance on the
  oldest supported physical devices.

## 17. Testing

### Contract tests

- TypeScript props match Swift and Kotlin accepted values.
- Unknown enum values fail safely or use a documented fallback.
- Events contain stable IDs and typed payloads.

### iOS

- Current iOS with Liquid Glass and oldest supported iOS fallback.
- Light/dark, Reduce Transparency, Increased Contrast, Reduce Motion, Dynamic
  Type, VoiceOver, orientation, and app lifecycle.
- Native controls visually checked against current Apple behavior.
- No accidental glass stacking, unreadable background sampling, or custom glass
  imitation.

### Android

- Oldest and current supported API levels.
- Material 3 stable and selected Expressive APIs.
- Light/dark, dynamic color on/off, font scale, TalkBack, reduced motion,
  predictive back, gesture/three-button navigation, and process recreation.
- Compose disposal and repeated React Native mount/unmount leak tests.

### Shared

- Same semantic operation and result across platforms.
- Platform-appropriate snapshots are reviewed separately; pixel equality across
  platforms is not a goal.
- Native UI tests cover pairing, clipboard, file progress, Lock confirmation,
  permission recovery, and Forget desktop.

## 18. Phase 1 native UI spike

Before completing the visual system:

1. Render one `@expo/ui/swift-ui` Button with standard and Liquid Glass
   appearances inside an Expo UI `Host`.
2. Render one `@expo/ui/jetpack-compose` Material Button inside its `Host`.
3. Wrap both behind the same OmarchyUI semantic props and receive the same intent.
   intent.
4. Verify pending/disabled states, screen readers, large text, dark mode, and
   unmount behavior.
5. Verify the iOS fallback on the oldest supported release.
6. Measure whether the chosen native view boundary adds unacceptable mount or
   layout overhead.

If the spike exposes unstable per-leaf hosting, move to larger Expo UI native
subtrees such as `NativeHomeActions` before creating custom Swift/Kotlin views.

## 19. Prohibited patterns

- A shared custom button styled to imitate both platforms.
- Liquid Glass recreated with React Native blur and gradients.
- Android components styled as translucent Apple controls.
- New iOS-only API calls without availability fallback.
- Remote capability data selecting arbitrary SF Symbols or Material icons.
- Network calls, authorization, or command execution inside view code.
- Business state duplicated independently inside Swift and Kotlin renderers.
- One native view per character, icon, spacer, or trivial static primitive.
- Snapshot tests that require iOS and Android to be pixel-identical.
- Direct `@expo/ui/swift-ui` imports in code that can load on Android, or direct
  Compose imports in code that can load on iOS.

## 20. Open decisions

1. Minimum iOS release and whether Liquid Glass is available only on a subset of
   supported devices.
2. Which P0 components use universal `@expo/ui` versus explicit platform trees.
3. Whether any documented P0 gap actually requires a custom native component.
4. Whether Phase 1 navigation uses React Navigation native-stack or a larger
   composite native screen boundary.
5. Whether the synchronized Omarchy accent is automatic or opt-in in P1.
6. Which Material 3 Expressive APIs are stable enough at implementation time.

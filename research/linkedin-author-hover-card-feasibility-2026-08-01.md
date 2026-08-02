# LinkedIn author hover-card feasibility

Date: 2026-08-01
Linear: ELOU-983
Scope: research and recommendation only

## Decision

The in-feed hover card should target the **feed-source actor**: the person whose like, comment, or repost caused the content to appear. That person may differ from the original post author.

The hover card should be the primary immediate unfollow path and can ship before the author roll-up. ELOU-981 remains useful as the browsable report and later supplies count and first/last-seen history to the hover card.

LinkedIn's native Unfollow command referring to the feed-source actor is the desired behavior. The implementation should reuse that exact native action after verifying that its name matches the source actor shown in the hover card.

## Live LinkedIn findings

The authenticated LinkedIn feed was inspected in the user's Chrome session with De-Slop and Pangram active.

- Hovering a native author name and avatar for more than three seconds did not produce a LinkedIn profile hover card in the current feed build. A De-Slop popover would not conflict with a visible native profile card in the observed state, but this is not a stable platform guarantee.
- The missing native hover card may be account-specific, an A/B experiment, or affected by the unusually short viewport created by docked developer tools. The recommendation does not depend on assuming that LinkedIn has removed hover cards globally.
- LinkedIn's feed markup uses obfuscated classes. The durable signals currently available are profile URLs, accessible control labels such as `Open control menu for post by …`, and visible control text.
- The feed-source actor and the post author can be different people, and LinkedIn's native menu targets the source actor:
  - A post by Matthew Holloway, surfaced because Charles L Mauro CHFP liked it, offered `Unfollow Charles L Mauro CHFP` in the native post menu.
  - A post by Adrián Mato Gondelle, surfaced because David Hoang commented, offered `Unfollow David Hoang`.
- A visible `Follow <name>` button proves that person is not followed. Its absence does not prove the person is followed; connected people and other feed states also omit it.
- The native `Unfollow <name>` menu item is the reliable confirmation that the feed-source actor is followed and can be acted on.

## Current De-Slop seams

De-Slop already captures useful post-author metadata while the original post is present, but it does not yet model the feed-source actor:

- `getOriginalPostAuthor()` resolves a name and profile URL from the control-menu label, Pangram handle, and profile links.
- Each replacement card keeps references to the hidden original target, the post permalink, and the captured author in the content-script world.
- The rendered `Original post by <author>` link may point to the post permalink instead of the profile when both are available. A future popover trigger must retain the profile URL separately rather than infer identity from the rendered `href`.
- A new extractor must capture the source actor, source profile URL, and reason (`liked`, `commented`, or `reposted`) from the feed-context row before hiding the original target. If there is no separate context row, the post author is the source actor.
- The replacement card should preserve both concepts: `Original post by <author>` for provenance and a separate `Shown because <source actor> <reason>` trigger for the immediate feed-management action.
- The original LinkedIn post is hidden with `display: none !important`. Its native menu cannot be presented cleanly beside a replacement card without revealing the original post or relying on fragile programmatic behavior.
- The extension currently stores only settings in `chrome.storage.sync`. The first hover-card version can omit history; ELOU-981 can add local source-actor history later.
- A byline for the source actor is not consistently present in the feed context row. Missing byline must be a valid state rather than a reason to substitute the post author's byline.

## Recommended sequence

1. **ELOU-982: implement the immediate feed-source action.** Capture the source actor and reason before replacement, expose a compact hover/focus card, and invoke LinkedIn's existing Unfollow action only after an explicit click and exact identity match.
2. **ELOU-981: build the local source-actor roll-up.** Store a canonical profile key, display name, number of hidden items introduced by that actor, and first/last-seen timestamps in `chrome.storage.local`.
3. **Enrich the hover card from the local store.** Add the history fields when ELOU-981 lands; do not block the initial unfollow workflow on them.

## Popover interaction contract

For the feed-source popover:

- Trigger it from a visible `Shown because <source actor> <reason>` row on pointer hover and keyboard focus; do not make hover the only path.
- Use one shared popover instance rather than listeners and DOM for every card.
- Keep the source actor's profile navigation available and preserve the separate original-post attribution.
- Let pointer movement enter the popover without closing it; close on pointer exit, blur, Escape, feed removal, or scroll that detaches the anchor.
- Do not imitate LinkedIn's visual skin. Use De-Slop's quiet neutral surface, compact system type, visible focus, and no decorative motion.
- Treat missing byline or history as a valid partial state.
- Show Unfollow only when LinkedIn exposes `Unfollow <same source actor>`; keep the final action behind an explicit user click.

## Risks

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Source actor is confused with post author | Records or acts on the wrong person | Store the source actor, reason, and post author as separate fields |
| Obfuscated LinkedIn markup changes | Source-actor or reason extraction fails | Prefer profile URLs, accessible labels, and bounded context-row text; omit the action when identity is uncertain |
| Original post is `display: none` | Native menu cannot anchor cleanly | Use a focused implementation spike to proxy the exact native action without exposing a second menu; fall back to Manage on LinkedIn if it cannot be done reliably |
| Hover-only interaction | Keyboard and touch users cannot reach it | Open on focus; retain normal profile navigation |
| Per-card listeners or observers | Reintroduces feed performance problems | Event delegation and one shared popover |
| Private LinkedIn API use | Brittle behavior and account/platform risk | Use visible native actions only |
| LinkedIn adds its own hover card later | Competing overlays | Detect a native open overlay and suppress De-Slop's popover |

## Outcome for ELOU-983

The feasibility investigation supports an immediate feed-source popover and Unfollow workflow in ELOU-982. It can ship before ELOU-981, while the roll-up remains the later reporting surface and history source. The native action must match the displayed source actor exactly.

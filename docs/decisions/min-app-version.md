# Decision: Minimum Obsidian Version

**ID:** D-O4  
**Date:** 2026-10-09  
**Decided by:** Project owner  

## Decision

Set `minAppVersion` to **1.14**.

## Rationale

The project owner has specified Obsidian version 1.14 as the minimum supported version. At the scaffold stage (P0-01), the plugin uses only basic APIs:

- `Plugin` base class (available since early Obsidian versions)
- `addCommand()` (available since early versions)

No advanced or recently-added APIs are used yet. However, the owner has set 1.14 as the floor to ensure compatibility with a stable, well-tested release that includes all modern plugin infrastructure improvements.

## APIs driving this choice

| API | Used in | Minimum version |
|-----|---------|-----------------|
| `Plugin` base class | `main.ts` | Available since early versions |
| `addCommand()` | `main.ts` | Available since early versions |

As the plugin evolves (P1–P8), additional APIs may require a higher `minAppVersion`. If so, this document will be updated with the new version and the specific APIs that drove the change.

## Consequences

- Users on Obsidian < 1.14 will not see the plugin available for install.
- Future phases should verify that any new API used is supported in 1.14, or raise the minimum accordingly.

# Privacy Policy — Aperture (OSINT Workbench)

**Last updated:** 23 July 2026

Aperture is a local-first browser extension for security analysts. This policy describes how the extension handles data.

## Summary

- Core features process data **on your device**.
- We (the developers) **do not** operate a backend that receives your investigation data, browsing activity, or telemetry.
- Network requests happen only when **you** choose to open public OSINT sites or enable optional Labs features.

## Data handled on your device

Depending on how you use Aperture, the extension may store locally (via browser storage / IndexedDB):

- Settings and feature flags
- Playbooks and recent indicators
- Cases, notes, tags, verdicts, and related investigation metadata
- Optional offline packs / caches you create or import

This data stays in your browser profile unless you export it yourself.

## Website content

If you enable **on-page IoC detect**, the extension reads text on pages you visit to find and highlight indicators of compromise and show a pivot card. That processing is local. Page content is not sent to the Aperture developers.

## Third-party OSINT sites

When you run a lookup or playbook, Aperture opens tabs to public tools you select (for example VirusTotal, AbuseIPDB, Shodan, URLScan). Those sites receive whatever appears in the URL or page you open, under **their** privacy policies. This only happens on your explicit action.

## Optional Labs features (off by default)

If you enable Labs options such as:

- **Local LLM** — prompts may be sent to a local endpoint you configure (for example Ollama on your machine)
- **API enrichment** — indicators and a session-provided API key may be sent to the provider you choose (for example AlienVault OTX)

These features are opt-in. API keys are intended for session use and are not designed to be stored in synced extension settings.

## Data we do not collect

Aperture does not sell user data. For core use we do not collect or transmit to the developers:

- Personally identifiable information for accounts or marketing
- Health, financial, or payment information
- Passwords or authentication cookies
- Location tracking
- Browsing history lists
- Analytics or telemetry about your usage

## Permissions

Aperture requests permissions such as `storage`, `contextMenus`, `tabs`, `activeTab`, and host access so it can save local investigation data, provide right-click lookup, open OSINT tabs, and (optionally) highlight IoCs on pages. Permissions are used only for these disclosed features.

## Changes

If this policy changes in a material way, we will update the date above and the copy in this file in the public repository.

## Contact

Questions about this policy: open an issue on the project repository  
https://github.com/petstuk/Aperture-OSINT-Workbench

# Release Notes — Aperture v3.0.1

## What's new
- **Have I Been Pwned** added as an OSINT service for email lookups (`https://haveibeenpwned.com/account/[email]`)
- Email pivot / quick tools list HIBP first
- New default playbook: **Email Breach Check** (HIBP → VirusTotal → AlienVault OTX)
- Still no API keys — opens the public HIBP account page in a new tab

## Package
```bash
./package-for-firefox.sh
# → aperture-osint-v3.0.1.zip
```

/* Offline dataset packs (embedded lite indexes — user-installable) */
(function (global) {
  const PACKS = {
    'attack-stix-lite': {
      id: 'attack-stix-lite',
      name: 'MITRE ATT&CK (lite)',
      description: 'Common techniques for local lookup',
      data: [
        { id: 'T1059', name: 'Command and Scripting Interpreter', tactics: ['Execution'] },
        { id: 'T1059.001', name: 'PowerShell', tactics: ['Execution'] },
        { id: 'T1003', name: 'OS Credential Dumping', tactics: ['Credential Access'] },
        { id: 'T1021', name: 'Remote Services', tactics: ['Lateral Movement'] },
        { id: 'T1071', name: 'Application Layer Protocol', tactics: ['Command and Control'] },
        { id: 'T1105', name: 'Ingress Tool Transfer', tactics: ['Command and Control'] },
        { id: 'T1218', name: 'System Binary Proxy Execution', tactics: ['Defense Evasion'] },
        { id: 'T1547', name: 'Boot or Logon Autostart Execution', tactics: ['Persistence'] },
        { id: 'T1566', name: 'Phishing', tactics: ['Initial Access'] },
        { id: 'T1566.001', name: 'Spearphishing Attachment', tactics: ['Initial Access'] },
        { id: 'T1566.002', name: 'Spearphishing Link', tactics: ['Initial Access'] },
        { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', tactics: ['Exfiltration'] },
        { id: 'T1190', name: 'Exploit Public-Facing Application', tactics: ['Initial Access'] },
        { id: 'T1486', name: 'Data Encrypted for Impact', tactics: ['Impact'] },
        { id: 'T1490', name: 'Inhibit System Recovery', tactics: ['Impact'] }
      ]
    },
    'lolbas-index': {
      id: 'lolbas-index',
      name: 'LOLBAS index (lite)',
      description: 'Common Living-off-the-Land binaries',
      data: [
        { name: 'certutil.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Certutil/' },
        { name: 'mshta.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Mshta/' },
        { name: 'regsvr32.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Regsvr32/' },
        { name: 'rundll32.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Rundll32/' },
        { name: 'powershell.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Powershell/' },
        { name: 'wmic.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Wmic/' },
        { name: 'bitsadmin.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Bitsadmin/' },
        { name: 'curl.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Curl/' },
        { name: 'msiexec.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Msiexec/' },
        { name: 'cmd.exe', url: 'https://lolbas-project.github.io/lolbas/Binaries/Cmd/' }
      ]
    },
    'gtfobins-index': {
      id: 'gtfobins-index',
      name: 'GTFOBins index (lite)',
      description: 'Common Unix binaries useful for privilege escalation',
      data: [
        { name: 'bash', url: 'https://gtfobins.github.io/gtfobins/bash/' },
        { name: 'python', url: 'https://gtfobins.github.io/gtfobins/python/' },
        { name: 'perl', url: 'https://gtfobins.github.io/gtfobins/perl/' },
        { name: 'find', url: 'https://gtfobins.github.io/gtfobins/find/' },
        { name: 'vim', url: 'https://gtfobins.github.io/gtfobins/vim/' },
        { name: 'awk', url: 'https://gtfobins.github.io/gtfobins/awk/' },
        { name: 'nmap', url: 'https://gtfobins.github.io/gtfobins/nmap/' },
        { name: 'tar', url: 'https://gtfobins.github.io/gtfobins/tar/' },
        { name: 'docker', url: 'https://gtfobins.github.io/gtfobins/docker/' },
        { name: 'sudo', url: 'https://gtfobins.github.io/gtfobins/sudo/' }
      ]
    }
  };

  function listPacks() {
    return Object.values(PACKS).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      entries: p.data.length
    }));
  }

  function getEmbeddedPack(id) {
    return PACKS[id] || null;
  }

  function lookupPack(id, query) {
    const pack = PACKS[id];
    if (!pack) return [];
    const q = String(query || '').toLowerCase().trim();
    if (!q) return pack.data.slice(0, 20);
    return pack.data.filter((row) => {
      const hay = JSON.stringify(row).toLowerCase();
      return hay.includes(q);
    });
  }

  global.AperturePacks = { listPacks, getEmbeddedPack, lookupPack, PACKS };
})(typeof self !== 'undefined' ? self : this);

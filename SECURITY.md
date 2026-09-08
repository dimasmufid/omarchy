# Security Policy

Omarchy Mobile controls a user session and transfers private content, so reports
that could expose a pairing credential, bypass authorization, escape the inbox,
or execute an unintended command should be handled privately.

## Supported versions

The project is currently a Phase 1 prerelease. Only the latest commit on `main`
is supported until the first tagged release. After releases begin, this table
will identify supported version lines and security-fix windows.

## Report a vulnerability

Use GitHub's **Report a vulnerability** button in the Security tab to open a
private vulnerability report. Do not include secrets, pairing URIs, private
files, or exploit details in a public issue.

Include, when possible:

- affected mobile and desktop commit or version;
- iOS/Android and Omarchy versions;
- the attacker position and required permissions;
- minimal reproduction steps with synthetic data;
- observed impact and any known mitigation.

Please retain logs privately and redact clipboard values, file content,
authorization headers, certificate private keys, and complete pairing URIs.
The maintainer will acknowledge the report, assess severity, coordinate a fix,
and publish remediation information appropriate to the risk.

## Security boundaries

Phase 1 supports one explicitly paired phone, foreground local-network use,
certificate-pinned TLS, device-scoped authorization, and hard-coded operations.
It does not intentionally expose a cloud relay or arbitrary shell execution.
The detailed trust and threat model is in
[`ai/specs/security-and-privacy.md`](ai/specs/security-and-privacy.md).

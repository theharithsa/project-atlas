---
name: service-foundation-tooling
description: Maintain Project Atlas repository checks, service registration and GitHub intake workflows.
---

# Repository tooling

The maintainer is theharithsa. This module runs in CI and on contributor machines. `scripts/check.sh` invokes the repository, link and PR-documentation checks followed by Python tooling tests and the Node application suite. `scripts/check_repository.py` validates template provenance and catalog records and checks tracked paths and credential markers at publication time. `scripts/add_service_skill.py` registers a service using the catalog schema.

The two GitHub intake workflows assign personal-repository issue types and fill missing milestones using GitHub metadata. PR changes and test suites run without production credentials. `scripts/repository_ruleset.py` reads the target and previews the policy by default. Its apply mode changes the named ruleset on explicit authorization. [Protection](../../docs/repository-ruleset.md)

Run `sh scripts/check.sh` with Python 3.11+ and Node 22. Keep test commands and CI aligned across Linux and Windows. [Testing](../../docs/testing.md) · [Continuation](continuation.md)

The preview server in `scripts/serve.mjs` reads the owner file from the local checkout. It calls the production settings validator and GitHub collector. [Preview guide](../../README.md#run-locally)

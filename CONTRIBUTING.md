# Contributing to Project Atlas

1. Open or reuse an issue with a user-visible outcome and acceptance criteria. For a data discrepancy, give the public GitHub link, dashboard view, active filters and last board check time. Use the security reporting route for sensitive details. [Issue forms](https://github.com/theharithsa/project-atlas/issues/new/choose) · [Security](SECURITY.md)
2. Branch from `main` and include the issue number in the branch name. Start the [local preview](README.md#run-locally). The [service inventory](docs/services.md) identifies the code and tests to change.
3. Run the relevant application tests and the full repository check. Use fictional data for regression cases and documentation screenshots. [Testing guide](docs/testing.md)
4. Open a pull request. Include `Closes #N` for an issue it resolves, actual test results, the documentation impact, and recovery steps for runtime changes. Keep the issue and PR on the same intended release milestone.
5. Merge through the checked PR. Release tags point to a reviewed commit on the default branch. Firebase publication is a separate maintainer operation. [Delivery and rollback](docs/delivery.md)

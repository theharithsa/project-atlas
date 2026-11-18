# Security reporting

Report suspected access-control defects, data exposure or credentials privately through [GitHub private vulnerability reporting](https://github.com/theharithsa/project-atlas/security/advisories/new). Include the affected route and a minimal reproduction using fictional values. Keep credentials, private issue content and customer information out of the report.

The hosted dashboard reads an explicit list of public GitHub boards without a GitHub credential. Repository scope and response fields live in [the API contract](docs/api.md). The authenticated comparison utility writes to a local ignored directory and is separate from the hosted service. The maintained source line is `main`.

# Contract Template Engine

## Purpose

This repository contains Markdown templates for generating French web development, hosting, maintenance, backup, and data processing agreements.

**This README is the implementation specification for Codex.** Implement the behavior described below. Do not silently change contractual language, infer legal facts, or generate a signable document when mandatory information is missing.

The engine must:

1. Load one or more Markdown templates.
2. Resolve conditional blocks from a validated configuration.
3. Replace `{{placeholders}}` with explicitly supplied values.
4. Remove template directives and empty optional structures.
5. Fix document structure, including heading and list numbering.
6. Validate the output and report errors before export.
7. Produce clean Markdown, with optional downstream PDF or DOCX conversion.

## 1. Template syntax

### 1.1 Placeholders

A placeholder has this exact form:

```text
{{namespace.field}}
```

Examples:

```markdown
**Contract reference:** {{contrat.reference}}
**Client:** {{client.nom}}
**Backup frequency:** {{sauvegardes.frequence}}
```

Rules:

- Placeholders are case-sensitive.
- A placeholder resolves only to a value explicitly present in the input data.
- Do not invent, translate, or estimate values.
- Unresolved placeholders in included content are **errors**.
- Placeholders inside excluded blocks do not require values.
- Plain-text values must be escaped for Markdown when required to prevent unwanted headings, links, tables, or template directives.
- Allow intentional Markdown fragments only for fields explicitly declared as `markdown` in a field schema. Treat other values as plain text.
- Missing and `null` values are missing. Empty strings count as missing for required fields. `0` and `false` are valid when a field allows them.

### 1.2 Conditional blocks

Use these exact, existing template delimiters:

```text
[OPTION : OPTION_NAME]
...content...
[/OPTION]
```

Example:

```markdown
[OPTION : SAUVEGARDES]

## Article 7 - Rolling backups

Backups are created every {{sauvegardes.frequence}}.

[/OPTION]
```

Rules:

- An opening directive starts a conditional region. A closing directive ends the most recent open region.
- An enabled region renders its contents, without either directive.
- A disabled region renders nothing, including headings, blank lines, and placeholders within it.
- Matching is case-sensitive and accent-sensitive. `HÉBERGEMENT` and `HEBERGEMENT` are not interchangeable.
- Allow spaces around the colon (`[OPTION: NAME]` and `[OPTION : NAME]`) for backward compatibility, but use `[OPTION : NAME]` when authoring new templates.
- A standalone `[/OPTION]` must be matched to an opener. Orphan closing directives and unclosed opening directives are fatal template errors.
- The same option may appear in multiple blocks or documents. All occurrences share the same Boolean value.
- **Support nested blocks.** A nested block renders only when all its enclosing blocks and its own option are enabled.
- Parse directives structurally, not with a single regular expression that greedily matches across nested blocks.

Example of nesting:

```markdown
[OPTION : HÉBERGEMENT]
## Article 5 - Hosting

[OPTION : HÉBERGEMENT OFFERT]
Hosting is provided free of charge for {{hebergement.duree_offerte}}.
[/OPTION]

[/OPTION]
```

With `HÉBERGEMENT=true` and `HÉBERGEMENT OFFERT=false`, render Article 5 but omit the free hosting paragraph. With `HÉBERGEMENT=false`, render neither.

### 1.3 Unknown option names

Fail validation if a template references an option not declared in the option registry. Do not silently treat unknown options as false. Suggest the exact expected spelling when feasible.

### 1.4 Literal directive text

If documentation or contractual content must display a directive literally, wrap it in a fenced code block. The parser must ignore directives and placeholders inside fenced code blocks by default. If a particular template needs substitution inside code blocks, add a deliberate, separately specified mechanism rather than making substitution implicit.

## 2. Canonical option registry

Keep these exact labels as the canonical names for the existing templates. Internally, the UI may map them to ASCII identifiers, but serialization and matching must remain unambiguous.

| Option | Meaning | Dependencies / constraints |
| --- | --- | --- |
| `HÉBERGEMENT` | Hosting service is included | Required for hosting-only sections and hosting annex |
| `HÉBERGEMENT OFFERT` | A free hosting period is included | Requires `HÉBERGEMENT` |
| `SLA CHIFFRÉ` | A numeric availability commitment applies | Requires `HÉBERGEMENT`; exclusive with `SANS SLA` |
| `SANS SLA` | No numeric availability commitment is specified | Requires `HÉBERGEMENT`; exclusive with `SLA CHIFFRÉ` |
| `MAINTENANCE` | Application maintenance is included | Independent of hosting |
| `SAUVEGARDES` | Backup service is included | Requires an applicable data/storage scope; do not assume it always requires hosting |
| `RPO_RTO` | Explicit recovery targets are included | Requires `SAUVEGARDES`; exclusive with `SANS RPO_RTO` |
| `SANS RPO_RTO` | No numeric recovery targets are specified | Requires `SAUVEGARDES`; exclusive with `RPO_RTO` |
| `NOM DE DOMAINE` | Domain management is included | Independent of hosting unless the quote specifies otherwise |
| `SUPERVISION` | Technical monitoring is included | Only if actually provided |
| `SUPPORT` | Technical support is included | Only if actually provided |
| `SUPPORT_PRIORITAIRE` | Priority support rules apply | Requires `SUPPORT` |
| `SOUS_TRAITANCE_RGPD` | Article 28 GDPR processor agreement is necessary | Determined by actual processing role, not an arbitrary customer opt-out |
| `DEVELOPPEMENT` | Development-related processor operations occur | Include in DPA only if relevant personal data is processed |
| `DONNEES_SENSIBLES` | Special categories of data are involved | Requires specific legal/technical assessment, not just a toggle |
| `AUTORISATION_GENERALE` | General authorization for subprocessors | Exclusive with `AUTORISATION_SPECIFIQUE` |
| `AUTORISATION_SPECIFIQUE` | Specific written authorization for subprocessors | Exclusive with `AUTORISATION_GENERALE` |
| `TRANSFERT_HORS_EEE` | International transfers outside the EEA occur | Requires details of destination and lawful transfer mechanism |
| `ASSISTANCE_DROITS_AVANCEE` | Additional contractual assistance features | Only if actually provided |

**Aliases:** Existing templates use accented labels and spaces. Do not automatically normalize accents or whitespace inside names. Explicit aliases may be introduced in a versioned mapping, with warnings, after the original templates have been migrated.

**Complete exclusive-choice validation:**

- When `HÉBERGEMENT=true`, exactly one of `SLA CHIFFRÉ` and `SANS SLA` must be true **for a template that offers that pair**.
- When `SAUVEGARDES=true`, exactly one of `RPO_RTO` and `SANS RPO_RTO` must be true **for a template that offers that pair**.
- When `SOUS_TRAITANCE_RGPD=true`, exactly one of `AUTORISATION_GENERALE` and `AUTORISATION_SPECIFIQUE` must be selected in the DPA.
- Do not force unrelated choices for documents that do not reference those choices.

## 3. Document inclusion and legal applicability

### 3.1 Main contract

Always generate the main contract for a new engagement. Its optional sections are driven by the option registry. Remove articles that have no applicable substantive content rather than leaving orphan headings.

### 3.2 Technical hosting annex

Generate the technical hosting annex when `HÉBERGEMENT=true`. It may include optional maintenance, backup, monitoring, support, and SLA content when applicable.

If a standalone backup or maintenance service is sold without hosting, generate only the relevant annex or sections according to the explicit document configuration. Do not imply that hosting was contracted.

### 3.3 GDPR data processing agreement (DPA)

Generate the DPA when `SOUS_TRAITANCE_RGPD=true`.

**Legal gate:** The GDPR processing role must be assessed as one of:

- `processor`: The provider processes personal data on the client's behalf. The DPA is required.
- `not_processor`: No processing on the client's behalf has been identified. The DPA is not required for that relationship.
- `undetermined`: The role has not been assessed. Block signable output and request a determination.

The option `SOUS_TRAITANCE_RGPD` must be derived from this role. Do not let a user disable the DPA while the role is `processor`. Hosting personal data or accessing live user data for maintenance can create a processor relationship even if the provider does not normally inspect records.

The DPA must include its Annex A (processing details and security measures) and Annex B (subprocessors and processing locations). These annexes are part of the DPA and are not independently optional. A verified empty subprocessor list may be expressed explicitly as `None`, not silently omitted.

Do not treat the existence of a DPA as proof of GDPR compliance. The legally required descriptions, instructions, security measures, and subprocessors must be properly completed.

## 3.4 Client identity: natural person vs legal entity

Client identification must adapt to the client's **legal nature**, independently of which services or annexes are selected. The French contract must not contain contradictory wording such as `dont le siège est situé au / domicilié au` or ask every client for a company representative.

### Identity discriminator

Require an explicit, validated `client.entity_type` enum:

- `natural_person`: An individual (`personne physique`), including an individual entrepreneur (`entrepreneur individuel`, EI) or micro-entrepreneur. An EI is **not** a separate legal entity simply because they have a SIREN.
- `legal_entity`: A separate legal entity (`personne morale`), such as a SAS, SARL or association.

Do not infer legal nature from the presence of a SIREN, a trading name, or a commercial email. The user must select or confirm the correct type. This classification is separate from the GDPR `processing_role` gate.

### Required and conditional fields

| Field | Natural person | Legal entity |
| --- | --- | --- |
| `client.entity_type` | Required: `natural_person` | Required: `legal_entity` |
| `client.prenom` and `client.nom_famille` | Required | Not required |
| `client.nom` (legal/display name) | Derived from verified first and last name when used by legacy templates | Required legal registered name (`dénomination` / `raison sociale`) |
| `client.adresse` | Required address / domicile, according to the contract | Required registered office address (`siège social`) |
| `client.forme_juridique` | Do not print a corporate legal form. If EI, use the EI-specific wording | Required legal form, when applicable (e.g. SAS, SARL, association) |
| `client.siren` | Required **only if** the natural person contracts as a registered business and has a SIREN | Required when registered in SIRENE; validate applicability for other entities |
| `client.representant` | Omit: the person signs in their own name | Required name and capacity of the authorized signatory |
| `client.signataire` | The individual, normally the same as first + last name | The authorized signatory |
| `client.qualite` | `individual` or `sole_proprietor` | Not applicable |
| `client.email` | Collect when needed for notifications | Collect when needed for notifications |

Do not require or fabricate a SIREN for an individual acting privately, or assume that every legal entity has the same registration regime. If an identifier is legally required for a specific entity, add an explicit validated field, e.g. `client.identifiant_registre`, rather than overloading `client.siren`.

### Conditional identity clauses

Use **registered, mutually exclusive derived options** for the client identification paragraph:

```markdown
**Le Client**

[OPTION : CLIENT_PERSONNE_PHYSIQUE]
{{client.prenom}} {{client.nom_famille}}, domicilié(e) au {{client.adresse}}.
[/OPTION]

[OPTION : CLIENT_ENTREPRENEUR_INDIVIDUEL]
{{client.prenom}} {{client.nom_famille}}, entrepreneur individuel (EI), immatriculé sous le numéro SIREN {{client.siren}}, domicilié(e) au {{client.adresse}}.
[/OPTION]

[OPTION : CLIENT_PERSONNE_MORALE]
{{client.nom}}, {{client.forme_juridique}}, dont le siège social est situé au {{client.adresse}}, {{client.immatriculation}}, représenté(e) par {{client.representant}} en qualité de {{client.fonction_representant}}.
[/OPTION]

Ci-après dénommé « le Client ».
```

The generator should derive **exactly one** of the three identity options from `client.entity_type` and, for natural persons, `client.qualite`:

- `natural_person + individual` -> `CLIENT_PERSONNE_PHYSIQUE`.
- `natural_person + sole_proprietor` -> `CLIENT_ENTREPRENEUR_INDIVIDUEL`.
- `legal_entity` -> `CLIENT_PERSONNE_MORALE`.

Treat `client.immatriculation` as a validated **complete phrase** supplied by an entity-specific formatter (for example, `immatriculée au RCS de ... sous le numéro ...`) or omit it where not applicable. Never output a dangling comma or an empty registration phrase. Prefer producing the entire party-identification paragraph from typed structured data if the current Markdown template structure makes optional punctuation hard to handle.

**Template migration required:** The current main-contract opening uses a single mixed client paragraph. Replace it with these branches (or an equivalent typed party formatter), instead of just adding an enum to the configuration. Apply compatible identity and signature formatting in any annex that names the client, including the DPA's `Responsable du traitement` block.

### Signature and role rules

- For a natural person, the signer is the individual. Do not add `représenté par` unless a separately documented mandate actually applies.
- For a legal entity, show the registered name and the natural person signing on its behalf, including their capacity (e.g. `président`, `gérant`, duly authorized representative).
- Do not copy the provider's EI status into the client's identity. The provider and the client are typed independently.
- The client being a natural person does **not** automatically mean they are a consumer. B2B vs consumer applicability requires a separate `client.contracting_capacity` assessment.
- Do not include more sensitive personal details than necessary for contracting. Never require an individual's date of birth or identity-document number by default.

### Example configuration

```json
{
  "client": {
    "entity_type": "natural_person",
    "qualite": "sole_proprietor",
    "prenom": "Camille",
    "nom_famille": "Martin",
    "adresse": "Example address, France",
    "siren": "123456789",
    "email": "camille@example.test"
  }
}
```

```json
{
  "client": {
    "entity_type": "legal_entity",
    "nom": "Example Studio",
    "forme_juridique": "SAS",
    "adresse": "Example registered office, France",
    "siren": "123456789",
    "representant": "Camille Martin",
    "fonction_representant": "présidente",
    "immatriculation": "immatriculée au RCS de Example City sous le numéro 123456789"
  }
}
```

These values are fictitious examples. Do not emit them in generated customer documents.

Validation must fail if the type or capacity is missing, if a legal entity has no authorized signatory, if an EI has no business identifier where required, or if the identity data conflicts with the selected branch. In final Markdown, no unused identity branch, stray slash, unmatched grammatical fragment, or placeholder may remain.

## 4. Suggested configuration contract

An implementation may choose any programming language, but should use a typed, validated configuration model. Example:

```json
{
  "documents": {
    "main_contract": true,
    "hosting_annex": true,
    "dpa": true
  },
  "processing_role": "processor",
  "options": {
    "HÉBERGEMENT": true,
    "HÉBERGEMENT OFFERT": false,
    "SLA CHIFFRÉ": false,
    "SANS SLA": true,
    "MAINTENANCE": true,
    "SAUVEGARDES": true,
    "RPO_RTO": false,
    "SANS RPO_RTO": true,
    "SUPERVISION": true,
    "SUPPORT": true,
    "SUPPORT_PRIORITAIRE": false,
    "SOUS_TRAITANCE_RGPD": true,
    "DEVELOPPEMENT": true,
    "AUTORISATION_GENERALE": true,
    "AUTORISATION_SPECIFIQUE": false,
    "TRANSFERT_HORS_EEE": false
  },
  "data": {
    "contrat": { "reference": "CTR-2026-001" },
    "client": { "nom": "Example Client" },
    "hebergement": { "fournisseur": "Example Infrastructure Provider" },
    "sauvegardes": { "frequence": "Daily" },
    "rgpd": { "reference": "DPA-2026-001" }
  }
}
```

This is a **partial illustrative configuration**, not a complete signable document. Actual generation requires every included mandatory field. The generator should derive `documents.dpa` and `options.SOUS_TRAITANCE_RGPD` from `processing_role`, rather than trusting mismatched values supplied by a UI.

## 5. Rendering pipeline

Implement the pipeline in this order:

1. **Load and tokenize** each UTF-8 Markdown template while preserving text and line breaks.
2. **Parse** conditional blocks into a nested syntax tree. Ignore fenced code blocks for directive parsing.
3. **Validate structure**: no unmatched directives, no unknown option labels, and no illegal nesting.
4. **Validate configuration**: dependencies, exclusivity, GDPR processing role, client legal nature and signatory authority, document inclusion, and required legal fields.
5. **Evaluate conditionals** recursively. Remove disabled blocks entirely.
6. **Resolve placeholders** in retained nodes only, with field-level escaping and type checks.
7. **Normalize Markdown**: remove empty headings, empty list items, and excess blank lines, without changing substantive clauses.
8. **Renumber** article and subsection headings if a section has been removed. Keep cross-references consistent.
9. **Validate the final output** for unresolved `{{...}}`, `[OPTION...]`, `[/OPTION]`, broken references, and missing required clauses.
10. **Export** the completed Markdown. Only then perform optional format conversion.

**Critical:** Never renumber headings by blindly replacing every number in the document. This can corrupt legal references such as `Article 28 RGPD`, `article 10.3`, retention periods, percentages, invoice numbers, or dates.

## 6. Heading numbering and cross-references

Existing templates use article headings such as:

```markdown
## Article 6 - Maintenance technique et sécurité
### 6.1 Maintenance technique
### 6.2 Sécurisation
### 6.3 Intervention et assistance
```

If only the hosting option is enabled, there may be a single visible subsection. The generator must avoid a dangling numbering sequence and ensure that references point to the final numbering.

Preferred robust implementation:

- Give headings stable **semantic identifiers** (e.g. `hosting.security`, `contract.termination.data_return`) in template metadata or a sidecar manifest.
- Number headings after conditional evaluation.
- Resolve cross-references by semantic identifier, not by parsing hardcoded French strings.
- For legacy templates with hardcoded references, maintain an explicit, tested reference map. If a valid rewrite cannot be guaranteed, **block output** and report the unresolved reference instead of guessing.
- Never modify references to external laws or regulations.

When every child block of an optional article is removed, remove the now-empty article heading as well. Preserve substantive top-level provisions that are not themselves optional.

## 7. Lists and Markdown formatting

- Conditional blocks may appear inside a Markdown list. Remove excluded items without leaving empty bullets.
- After rendering, validate ordered list numbering. Markdown accepts repeated `1.` list prefixes, but final legal documents should display consecutive numbers.
- Example: the main contract's document list conditionally includes the DPA. If the option is off, omit that list item and renumber the remaining items as needed.
- Retain paragraphs, emphasis, line breaks, tables, and block quotes unless removing optional content requires formatting cleanup.
- Do not add or change contractual promises while cleaning formatting.
- Preserve French typographic conventions inside contract text.

## 8. Validation rules and errors

The generator must reject signable output when:

- Any opening or closing option directive is unmatched.
- A template uses an undeclared option.
- An included required placeholder is missing or empty.
- Mutually exclusive options are simultaneously enabled or both disabled when one is required.
- A dependent option is enabled without its prerequisite.
- The GDPR role is `undetermined` or `processor` without a completed DPA.
- The client identity is inconsistent with `client.entity_type`, or mandatory identity/signatory information is missing.
- Required Annex A or Annex B details are absent.
- A required field such as processor instructions, retention rules, processing purpose, technical measures, or data locations is missing.
- A contractual cross-reference cannot be resolved after conditional sections are removed.
- An option marker or placeholder remains in final output.

Prefer actionable diagnostics:

```text
ERROR templates/main-contract.md:110:
Unclosed option block: HÉBERGEMENT

ERROR templates/dpa.md:42:
Missing required value: rgpd.finalites

ERROR configuration:
RPO_RTO requires SAUVEGARDES=true

ERROR legal validation:
processing_role=processor requires a completed DPA
```

Use file paths and line numbers when possible. Do not auto-correct legally material errors silently.

## 9. Template authoring conventions

- One condition per opening directive; no inline Boolean expressions such as `[OPTION : A && B]`.
- For combined requirements, use nested blocks or a derived registered option.
- Always put opening and closing directives on their own lines.
- Use a single canonical spelling for each option label.
- Close each block near the content it controls.
- Place optional article headings **inside** their condition when the whole article is optional.
- Keep the matching `[/OPTION]` after all child blocks, especially when nesting `HÉBERGEMENT OFFERT` inside `HÉBERGEMENT`.
- Do not duplicate the same clause in separate conditional branches unless the wording must actually differ.
- Avoid promises of specific uptime, response time, RPO, RTO, encryption, or backup frequency unless supported by real operations and configured values.
- Do not use an option to suppress a legally mandatory clause for a relationship to which that clause applies.

## 10. Codex implementation checklist

- [ ] Define and type the canonical options registry.
- [ ] Build a line-aware tokenizer and stack-based conditional parser.
- [ ] Add robust nested block support.
- [ ] Validate document-level dependencies and exclusive option groups.
- [ ] Determine DPA applicability from the assessed processing role.
- [ ] Add natural-person, sole-proprietor, and legal-entity client identity branches; validate identity and signature fields.
- [ ] Resolve placeholders after conditional evaluation.
- [ ] Escape plain-text fields and allow explicitly declared Markdown fields.
- [ ] Normalize empty Markdown structures.
- [ ] Implement semantic heading IDs and safe cross-reference resolution.
- [ ] Add line-numbered, actionable validation errors.
- [ ] Add deterministic output snapshots.
- [ ] Add unit tests and end-to-end tests.
- [ ] Reject incomplete legal documents instead of exporting them as final.

### Required test cases

1. No optional services: no orphan headers or markers.
2. Hosting only, without SLA.
3. Hosting with quantified SLA.
4. Hosting with free period nested inside hosting.
5. Application maintenance without hosting.
6. Backups with and without RPO/RTO.
7. Hosting plus backups plus maintenance.
8. Processor relationship: DPA generated with both annexes.
9. No processor relationship: DPA omitted.
10. Undetermined processor role: generation blocked.
11. Nested blocks with disabled parent and enabled child: child omitted.
12. Unknown option: error.
13. Unclosed opening directive: error.
14. Orphan closing directive: error.
15. Unresolved placeholder in included block: error.
16. Missing placeholder in excluded block: no error.
17. Contradictory options: error.
18. Cross-reference to a removed article: error, not silent corruption.
19. Literal directives inside fenced code blocks: preserved verbatim.
20. Optional numbered list item: clean numbering after removal.
21. Private natural-person client: no SIREN, corporate legal form, or representative phrase.
22. EI/micro-entrepreneur client: natural-person wording with SIREN; not treated as legal entity.
23. Legal-entity client: registered name, appropriate registration, and authorized signatory with capacity.
24. Missing or conflicting client legal nature / signatory: error, not guessed content.
25. Client identity remains consistent across the main contract, technical annex, DPA and signature blocks.

## 11. Definition of done

The feature is complete when the engine can generate a clean, deterministic Markdown contract and applicable annexes from validated configuration, while preserving all retained contractual wording. No template syntax, blank placeholder, structural error, or broken cross-reference may appear in a signable output.

**Scope boundary:** The engine automates document assembly; it does not determine legal compliance or replace qualified legal review. Legal applicability must be assessed and mandatory annexes completed before signature.

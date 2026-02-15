## ADDED Requirements

### Requirement: 经济 fallback 仅在严格准入条件下触发
The system MUST trigger economic fallback only when no equivalent economic mutation exists and fallback preconditions are satisfied.

#### Scenario: Fallback injects only when economic mutation is missing
- **WHEN** state commands contain no recognized economic mutation and fallback input passes access checks
- **THEN** fallback SHALL inject exactly one economic repair mutation
- **AND** injected mutation SHALL include explicit reason metadata for traceability

#### Scenario: Existing economic mutation suppresses fallback
- **WHEN** state commands already include recognized economic mutation intent
- **THEN** fallback SHALL NOT inject additional economic mutation
- **AND** duplicate-accounting risk SHALL be prevented by default

### Requirement: 经济 fallback 必须可解释并可审计
The system MUST produce explanation-friendly diagnostics whenever fallback is applied or skipped.

#### Scenario: Applied fallback is visible in run result diagnostics
- **WHEN** fallback is applied in a state service run
- **THEN** run diagnostics SHALL include a repair marker indicating fallback application
- **AND** marker content SHALL allow operators to identify injected delta direction/value context

#### Scenario: Skipped fallback reports skip reason class
- **WHEN** fallback is evaluated but not applied due to gating conditions
- **THEN** diagnostics SHALL expose skip reason class (for example: no-access, non-structured-input, or existing-economic-mutation)
- **AND** operators SHALL be able to distinguish expected skip from extraction failure

### Requirement: 经济 fallback 不得突破变量范围约束
The system MUST apply fallback outputs within scope governance constraints and SHALL reject fallback outputs that violate domain/sheet/field boundaries.

#### Scenario: Fallback respects scope allowlist
- **WHEN** fallback proposes a repair mutation
- **THEN** the mutation SHALL be validated against domain/sheet/field scope allowlist before commit
- **AND** out-of-scope fallback mutation SHALL be rejected with a diagnosable reason

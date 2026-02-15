## ADDED Requirements

### Requirement: 回放一致性必须提供量化门禁
The system MUST evaluate state-variable replay consistency using quantifiable diff totals and SHALL expose these totals for regression gating.

#### Scenario: Replay matches baseline
- **WHEN** replayed snapshot and baseline snapshot represent equivalent state-variable outcomes
- **THEN** diff result SHALL mark `matched=true`
- **AND** totals for missing rows and changed rows/cells SHALL all be zero

#### Scenario: Replay mismatch is explicitly quantified
- **WHEN** replayed snapshot diverges from baseline
- **THEN** diff result SHALL mark `matched=false`
- **AND** totals SHALL quantify at least missing-in-replay, missing-in-baseline, changed-rows, and changed-cells
- **AND** per-sheet summaries SHALL be available for diagnosis

### Requirement: 回放输入异常必须计数并可见
The system MUST validate replay event-log rows and SHALL count invalid rows instead of silently consuming malformed data.

#### Scenario: Invalid replay rows are counted
- **WHEN** event-log rows miss required fields or contain invalid timestamp/value formats
- **THEN** those rows SHALL be excluded from replay event list
- **AND** invalid row count SHALL be returned as a first-class replay diagnostic output

### Requirement: State 不稳定性指标必须投影到统一质量视图
The system MUST project state-writer reliability metrics and conflict-rate signals into validation issue tables for operational debugging.

#### Scenario: Writer runtime metrics appear in validation issues
- **WHEN** state writer shadow/queue/failure metrics are present in runtime state metadata
- **THEN** validation issue projection SHALL include metric rows for shadow, queue, and failure distribution
- **AND** each metric row SHALL contain machine-readable identifiers and human-readable message summaries

#### Scenario: Conflict-rate metric is emitted with severity
- **WHEN** transaction conflict statistics are available for recent turns
- **THEN** validation issue projection SHALL include a conflict-rate metric row
- **AND** severity SHALL reflect configured threshold bands rather than binary pass/fail only

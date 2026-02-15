## ADDED Requirements

### Requirement: 变量范围必须遵循 domain+sheet+field 严格白名单
The system MUST validate state write intent against an explicit domain-to-sheet-to-field allowlist, and MUST reject out-of-scope writes with a diagnosable reason.

#### Scenario: In-scope write passes scope validation
- **WHEN** a state write targets an allowed domain, allowed sheet, and allowed field set
- **THEN** scope validation SHALL pass
- **AND** the write MAY continue to transaction/version checks

#### Scenario: Out-of-scope write is rejected with reason
- **WHEN** a state write targets a disallowed domain, disallowed sheet, or disallowed field
- **THEN** the write SHALL be rejected before successful commit
- **AND** rejection reason SHALL be recorded in conflict/validation diagnostics
- **AND** no silent acceptance of out-of-scope mutation SHALL occur

### Requirement: 跨回合写入必须产生软告警而非默认硬阻断
The system MUST detect turn-scope violations for state writes and SHALL emit warning-grade diagnostics without default hard blocking.

#### Scenario: Cross-turn write generates warning trace
- **WHEN** a state write is identified as crossing allowed turn scope
- **THEN** the system SHALL emit a warning signal with turn/source/domain/sheet context
- **AND** the write SHALL remain non-blocking by default unless stricter mode is explicitly enabled

### Requirement: 语义约束必须可解释并可观测
The system MUST attach explicit semantic hints/anchors used by state writing decisions, and SHALL expose whether semantic guidance was applied, missing, or ambiguous.

#### Scenario: Semantic hints are present for constrained domains
- **WHEN** state input payload is built for constrained domains
- **THEN** semantic guidance metadata SHALL be included in payload/context
- **AND** downstream diagnostics SHALL be able to indicate whether semantic guidance influenced final writes

#### Scenario: Semantic ambiguity is surfaced as diagnostic
- **WHEN** semantic extraction confidence is insufficient for a constrained write decision
- **THEN** the system SHALL emit a warning-grade diagnostic indicating ambiguity
- **AND** resulting writes SHALL still remain within domain scope allowlist boundaries

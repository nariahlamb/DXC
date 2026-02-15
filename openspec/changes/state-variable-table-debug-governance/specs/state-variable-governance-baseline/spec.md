## ADDED Requirements

### Requirement: State 写入路径必须保持严格服务边界
The system MUST enforce strict routing for `memory`, `state`, and `map` service paths, and state table writes SHALL only be produced by the state path plus explicitly allowed writer cutover flow.

#### Scenario: Strict routing remains isolated
- **WHEN** a turn triggers all enabled services in one interaction
- **THEN** `memory` requests SHALL execute only through memory routing
- **AND** `state` requests SHALL execute only through state routing
- **AND** `map` requests SHALL execute only through map routing
- **AND** no cross-service table-write command SHALL be accepted without passing service boundary guards

### Requirement: State 写入失败必须被统一分类并可追踪
The system MUST classify state write outcomes into `rollback`, `skip`, and `fallback`, and SHALL expose classification signals through runtime metadata and/or audit tables.

#### Scenario: Transaction conflict is classified as rollback
- **WHEN** state write application hits `source_not_allowed`, `row_version_conflict`, `sheet_version_conflict`, or apply error
- **THEN** the transaction SHALL be rolled back atomically
- **AND** conflict reason counters SHALL be incremented in conflict statistics
- **AND** rollback evidence SHALL be recoverable from transaction journal metadata

#### Scenario: Writer pre-apply rejection is classified as skip
- **WHEN** writer consumes an event rejected as `duplicate_idempotency`, `stale_event`, `invalid_event`, or `no_command`
- **THEN** no business table mutation command SHALL be emitted for that event
- **AND** skip reason SHALL be recorded in writer runtime metrics

#### Scenario: Service-level economic repair is classified as fallback
- **WHEN** state response lacks economic mutation while fallback preconditions are satisfied
- **THEN** a fallback mutation command SHALL be injected through the fallback path
- **AND** the run result SHALL include an explanatory repair marker

### Requirement: State 审计链路必须保持可回放与可对账
The system MUST persist enough audit evidence to correlate input events, apply outcomes, and transaction effects for state-variable domains.

#### Scenario: Event and apply logs can be correlated
- **WHEN** state writer produces event/apply logs for one turn
- **THEN** each apply record SHALL reference its source event identity
- **AND** audit rows SHALL retain turn/source/domain/path context required for replay and diagnosis
- **AND** missing mandatory log fields SHALL be counted as invalid replay inputs rather than silently accepted

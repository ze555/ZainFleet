# Enterprise Fleet Phase 2 — Implementation Specification

Status: planned; this document defines the implementation contract. It does not claim that these features are implemented.

Target branch: `enterprise-fleet-phase2`
Base commit: `4fa91c936390f0260100a50698cc844070e4e2d2`

## Delivery principles

1. Preserve the existing Teltonika TCP listener, packet parser, ACK behavior, and current vehicle dashboard.
2. Do not build new business modules on top of JSON-file persistence. Phase 1's PostgreSQL migration and tenant isolation are prerequisites.
3. Every business record is scoped by `tenantId`; the server derives tenant access from the authenticated session, never from a client-supplied tenant ID alone.
4. Keep existing deployments backward compatible while introducing migrations and feature flags.
5. No feature is commercially complete until API, UI, validation, tenant authorization, audit trail, tests, and operator documentation exist.

## Prerequisite gate: Phase 1 foundation

Before enabling Phase 2 in production:
- PostgreSQL persistence and versioned migrations.
- Tenant-scoped repositories and authorization checks.
- Stable session secret from environment; fail startup if missing in production.
- Remove default production credentials; require initial admin bootstrap.
- Durable storage for device telemetry and diagnostic events.
- Automated backup and restore test.
- CI build and automated tests.

## Domain modules

### 1. Driver management

Entities:
- Driver: id, tenantId, employeeCode, fullName, phone, licenseNumber, licenseExpiry, status, notes, createdAt, updatedAt.
- DriverVehicleAssignment: id, tenantId, driverId, deviceImei, validFrom, validTo, assignedBy.
- DriverEvent: id, tenantId, driverId, deviceImei, eventType, occurredAt, source, metadata.

Capabilities:
- CRUD, search, status and licence-expiry tracking.
- Assign and unassign a driver to a vehicle/device with effective dates.
- Prevent overlapping active assignments for the same vehicle unless explicitly allowed.
- Driver attribution for trips and alerts only when assignment is unambiguous.
- Import/export CSV with validation.

### 2. Maintenance and work orders

Entities:
- MaintenanceAssetProfile: tenantId, deviceImei, vehicleLabel, make, model, year, plateNumber, odometerSource, currentOdometerKm.
- MaintenancePlan: tenantId, deviceImei, title, intervalKm, intervalDays, nextDueKm, nextDueAt, enabled.
- WorkOrder: tenantId, number, deviceImei, driverId?, category, priority, status, description, openedAt, dueAt?, closedAt?, odometerKm?, costTotal, vendor?, notes.
- WorkOrderLine: tenantId, workOrderId, description, quantity, unitCost, total.
- MaintenanceReminder: tenantId, planId, dueAtKm?, dueAtDate?, status.

Capabilities:
- Create work orders, assign technician/vendor, track status (open, in_progress, waiting_parts, completed, cancelled).
- Schedule preventive maintenance by date and/or odometer.
- Calculate next due date/km; create configurable reminders.
- Attach costs and parts/labour lines.
- Use GPS odometer only when its source and freshness are known; never silently treat GPS-derived distance as CAN odometer.
- Do not create automatic diagnostic repair recommendations from DTC codes without validated vehicle-specific rules.

### 3. Fuel and operating costs

Entities:
- FuelTransaction: tenantId, deviceImei, driverId?, occurredAt, litres, unitPrice, totalCost, odometerKm?, station?, receiptReference?, source (manual/import/integration), notes.
- VehicleExpense: tenantId, deviceImei, category, occurredAt, amount, currency, vendor?, reference?, notes.
- FuelReading: tenantId, deviceImei, occurredAt, levelPercent?, levelLitres?, totalFuelConsumedLitres?, source, quality.

Capabilities:
- Manual fuel-fill entry and CSV import.
- Store tracker/CAN readings separately from verified fuel transactions.
- Compute cost per km, litres per 100 km, monthly spend, and fuel-fill history only when the required data quality thresholds are met.
- Flag suspicious changes as review alerts, not confirmed fraud.
- Support configurable currency; default display may be LYD but no hard-coded currency in persisted values.

### 4. Geofencing

Entities:
- Geofence: tenantId, name, shape (circle or polygon), centerLat?, centerLng?, radiusMeters?, polygonGeoJson?, enabled.
- GeofenceAssignment: tenantId, geofenceId, deviceImei.
- GeofenceEvent: tenantId, geofenceId, deviceImei, eventType (enter/exit), occurredAt, latitude, longitude, sourceRecordId?, dedupeKey.

Capabilities:
- Circle and polygon zones.
- Assign zones to selected vehicles or groups.
- Enter/exit detection from ordered GPS points.
- Hysteresis/minimum dwell and duplicate suppression to reduce GPS jitter.
- Ignore invalid GNSS fixes and stale/out-of-order points.
- Event processing must be idempotent; retain the raw point reference for audit.
- Initial polygon evaluation may use a tested point-in-polygon library; use PostGIS when the database foundation supports it.

### 5. Configurable alerts and notification delivery

Entities:
- AlertRule: tenantId, name, eventType, conditionsJson, enabled, severity, cooldownSeconds, recipientsJson.
- AlertEvent: tenantId, ruleId, deviceImei?, driverId?, eventType, severity, occurredAt, payloadJson, dedupeKey, status.
- NotificationDelivery: tenantId, alertEventId, channel, recipient, status, attempts, lastAttemptAt, providerMessageId?, error?.

Initial event types:
- geofence_enter / geofence_exit
- vehicle_online / vehicle_offline
- overspeed
- ignition_on / ignition_off
- maintenance_due
- license_expiry
- fuel_review_required

Capabilities:
- Tenant-admin rule builder with thresholds, schedules, vehicle/group scope, severity, cooldown, and recipients.
- In-app alert inbox first.
- Email integration after provider configuration.
- SMS/WhatsApp only through a selected provider and verified credentials; do not fake delivery.
- Retry with bounded backoff, delivery logs, and deduplication.
- Alert evaluation must not block the TCP packet ACK path.

### 6. Management reports

Initial reports:
- Fleet utilization and distance by vehicle/period.
- Trips, idle time, and engine hours.
- Driver assignment and driving events.
- Fuel transactions, consumption, and spend.
- Maintenance due, work-order status, and maintenance spend.
- Geofence visits and dwell time.
- Alert counts and acknowledgement/closure.
- CSV export first; PDF export only after stable report templates.

Requirements:
- Filter by tenant, vehicle, driver, date range, and group.
- Show source and freshness for telemetry-derived values.
- Explain missing/insufficient data rather than display fabricated zeroes.
- Paginate large reports and run expensive exports asynchronously.

## API contract (proposed)

All endpoints require authentication and tenant authorization.

- `/api/drivers`, `/api/drivers/:id`, `/api/drivers/:id/assignments`
- `/api/maintenance/plans`, `/api/maintenance/work-orders`, `/api/maintenance/work-orders/:id`
- `/api/fuel/transactions`, `/api/fuel/readings`, `/api/expenses`
- `/api/geofences`, `/api/geofences/:id/assignments`, `/api/geofences/events`
- `/api/alert-rules`, `/api/alerts`, `/api/alerts/:id/acknowledge`
- `/api/reports/fleet`, `/api/reports/fuel`, `/api/reports/maintenance`, `/api/reports/drivers`

Use request schemas, pagination, consistent error responses, and audit records for all mutations.

## Suggested delivery sequence

1. Complete Phase 1 persistence, tenant isolation, authentication hardening, backup/restore, and CI.
2. Driver records and dated vehicle assignments.
3. Maintenance assets, plans, work orders, and reminders.
4. Fuel transactions and expenses; keep raw telemetry distinct.
5. Geofence definitions and deterministic enter/exit event engine.
6. Alert rules, event inbox, and notification delivery adapters.
7. Management reports and CSV export.
8. End-to-end tests using synthetic Teltonika records and at least one real-device acceptance test.

## Acceptance criteria

- Cross-tenant reads and writes are denied by automated tests for every module.
- Restarting/redeploying does not lose drivers, assignments, maintenance, fuel, geofences, alerts, or reports.
- Duplicate and out-of-order GPS packets do not create duplicate geofence events.
- Geofence transitions are reproducible from stored GPS records.
- Fuel KPIs distinguish manual transactions from tracker estimates and expose missing data.
- Maintenance reminders are idempotent and can be acknowledged/closed.
- Alert evaluation never delays or prevents Teltonika ACK responses.
- Report totals reconcile to their underlying records and respect tenant filters.
- CI passes build, unit, integration, and authorization tests.

## Explicit non-goals for this phase

- Selling or transferring the source-code IP.
- AI-driven driver scoring or predictive maintenance without validated training/operational data.
- Automatic claims of fuel theft or vehicle fault diagnosis.
- SMS/WhatsApp delivery before provider selection and credentials.
- Production deployment before the prerequisite gate is met.

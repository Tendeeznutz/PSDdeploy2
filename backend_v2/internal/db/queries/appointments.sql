-- name: GetAppointment :one
SELECT * FROM appointments WHERE id = $1 LIMIT 1;

-- name: ListAppointments :many
SELECT * FROM appointments ORDER BY created_at DESC;

-- name: ListAppointmentsByCustomer :many
SELECT * FROM appointments WHERE "customerId" = $1 ORDER BY created_at DESC;

-- name: ListAppointmentsByTechnician :many
SELECT * FROM appointments WHERE "technicianId" = $1 ORDER BY created_at DESC;

-- name: ListAppointmentsByStatus :many
SELECT * FROM appointments WHERE "appointmentStatus" = $1 ORDER BY created_at DESC;

-- name: ListAppointmentsByTechnicianAndStatus :many
SELECT * FROM appointments
WHERE "technicianId" = $1 AND "appointmentStatus" = $2
ORDER BY "appointmentStartTime";

-- name: ListActiveAppointmentsForTechnician :many
SELECT * FROM appointments
WHERE "technicianId" = $1
  AND "appointmentStatus" IN ('1','2')
ORDER BY "appointmentStartTime";

-- name: ListCancelledAppointmentsForCustomerInMonth :many
SELECT * FROM appointments
WHERE "customerId"        = $1
  AND "appointmentStatus" = '4'
  AND date_trunc('month', TO_TIMESTAMP("appointmentStartTime")) = date_trunc('month', $2::TIMESTAMPTZ)
ORDER BY created_at DESC;

-- name: CreateAppointment :one
INSERT INTO appointments (
    "customerId","technicianId","appointmentStartTime","appointmentEndTime",
    "airconToService","appointmentStatus","paymentMethod"
) VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING *;

-- name: UpdateAppointment :one
UPDATE appointments SET
    "technicianId"         = COALESCE(sqlc.narg('technicianId'),        "technicianId"),
    "appointmentStartTime" = COALESCE(sqlc.narg('appointmentStartTime'),"appointmentStartTime"),
    "appointmentEndTime"   = COALESCE(sqlc.narg('appointmentEndTime'),  "appointmentEndTime"),
    "airconToService"      = COALESCE(sqlc.narg('airconToService'),     "airconToService"),
    "appointmentStatus"    = COALESCE(sqlc.narg('appointmentStatus'),   "appointmentStatus"),
    "paymentMethod"        = COALESCE(sqlc.narg('paymentMethod'),       "paymentMethod"),
    "customerFeedback"     = COALESCE(sqlc.narg('customerFeedback'),    "customerFeedback"),
    "cancellationReason"   = COALESCE(sqlc.narg('cancellationReason'),  "cancellationReason"),
    "cancelledBy"          = COALESCE(sqlc.narg('cancelledBy'),         "cancelledBy"),
    "cancelledAt"          = COALESCE(sqlc.narg('cancelledAt'),         "cancelledAt"),
    updated_at             = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: CountCompletedAppointmentsForTechnician :one
SELECT COUNT(*) FROM appointments
WHERE "technicianId" = $1 AND "appointmentStatus" = '3';

-- name: CountCancelledByTechOrCoordInMonth :one
SELECT COUNT(*) FROM appointments
WHERE ("cancelledBy" = 'technician' OR "cancelledBy" = 'coordinator')
  AND "appointmentStatus" = '4'
  AND date_trunc('month', "cancelledAt") = date_trunc('month', NOW())
  AND "technicianId" = $1;

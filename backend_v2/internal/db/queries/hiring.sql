-- name: GetHiringApplication :one
SELECT * FROM technician_hiring_applications WHERE id = $1 LIMIT 1;

-- name: GetHiringApplicationByNRIC :one
SELECT * FROM technician_hiring_applications WHERE nric = $1 LIMIT 1;

-- name: ListHiringApplications :many
SELECT * FROM technician_hiring_applications ORDER BY created_at DESC;

-- name: ListHiringApplicationsByStatus :many
SELECT * FROM technician_hiring_applications
WHERE "applicationStatus" = $1 ORDER BY created_at DESC;

-- name: ListHiringApplicationsByName :many
SELECT * FROM technician_hiring_applications
WHERE "applicantName" ILIKE $1 ORDER BY created_at DESC;

-- name: CreateHiringApplication :one
INSERT INTO technician_hiring_applications (
    "applicationSource","applicantName",nric,citizenship,
    "applicantAddress","applicantPostalCode","applicantPhone","applicantEmail",
    "workExperience","resumeFile","resumeFileName","hasCriminalRecord","criminalRecordDetails",
    race,"languagesSpoken","previousEmployer","lastEmployedYear","lastDrawnSalary",
    "nextOfKinName","nextOfKinContact","nextOfKinRelationship",
    "isMedicallyFit","profilePhoto","profilePhotoFileName",
    "nricPhotoFront","nricPhotoBack","drivingLicense","drivingLicenseFileName",
    specializations,"applicationStatus"
) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
    $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
) RETURNING *;

-- name: ConfirmPersonalDetails :one
UPDATE technician_hiring_applications SET
    "personalDetailsConfirmed"   = TRUE,
    "personalDetailsConfirmedAt" = NOW(),
    "applicationStatus"          = 'bank_info',
    updated_at                   = NOW()
WHERE id = $1
RETURNING *;

-- name: SubmitBankInfo :one
UPDATE technician_hiring_applications SET
    "bankName"              = $2,
    "bankAccountNumber"     = $3,
    "bankAccountHolderName" = $4,
    "bankInfoConfirmed"     = TRUE,
    "bankInfoConfirmedAt"   = NOW(),
    "applicationStatus"     = 'coordinator_review',
    updated_at              = NOW()
WHERE id = $1
RETURNING *;

-- name: CoordinatorApprove :one
UPDATE technician_hiring_applications SET
    "coordinatorId"       = $2,
    "payRate"             = $3,
    "coordinatorNotes"    = $4,
    "coordinatorApproved" = TRUE,
    "coordinatorApprovedAt" = NOW(),
    "applicationStatus"   = 'approved',
    "createdTechnician"   = $5,
    updated_at            = NOW()
WHERE id = $1
RETURNING *;

-- name: CoordinatorReject :one
UPDATE technician_hiring_applications SET
    "coordinatorId"       = $2,
    "coordinatorNotes"    = $3,
    "coordinatorApproved" = FALSE,
    "coordinatorApprovedAt" = NOW(),
    "applicationStatus"   = 'rejected',
    updated_at            = NOW()
WHERE id = $1
RETURNING *;

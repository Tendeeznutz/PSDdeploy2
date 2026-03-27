// Package seeder seeds the database with known test fixtures.
// It is idempotent: safe to run on an already-seeded DB.
package seeder

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const defaultPassword = "password123"

// Seed inserts the canonical test data (2 coordinators, 3 technicians,
// 4 customers, 15 aircon catalog entries).  Uses ON CONFLICT DO NOTHING.
func Seed(ctx context.Context, pool *pgxpool.Pool) error {
	log.Println("seeder: starting...")

	hash, err := hashPassword(defaultPassword)
	if err != nil {
		return fmt.Errorf("seeder: hash password: %w", err)
	}

	if err := seedCoordinators(ctx, pool, hash); err != nil {
		return err
	}
	if err := seedTechnicians(ctx, pool, hash); err != nil {
		return err
	}
	if err := seedCustomers(ctx, pool, hash); err != nil {
		return err
	}
	if err := seedCatalog(ctx, pool); err != nil {
		return err
	}

	log.Println("seeder: done")
	return nil
}

func hashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func seedCoordinators(ctx context.Context, pool *pgxpool.Pool, hash string) error {
	coordinators := []struct {
		name, email, phone string
	}{
		{"Admin Coordinator", "admin@airserve.com", "91111111"},
		{"John Admin", "john.admin@airserve.com", "91111112"},
	}
	for _, c := range coordinators {
		_, err := pool.Exec(ctx,
			`INSERT INTO coordinators ("coordinatorName","coordinatorEmail","coordinatorPhone","coordinatorPassword")
			 VALUES ($1,$2,$3,$4) ON CONFLICT ("coordinatorEmail") DO NOTHING`,
			c.name, c.email, c.phone, hash,
		)
		if err != nil {
			return fmt.Errorf("seeder: coordinator %s: %w", c.email, err)
		}
	}
	log.Printf("seeder: coordinators OK (%d)", len(coordinators))
	return nil
}

func seedTechnicians(ctx context.Context, pool *pgxpool.Pool, hash string) error {
	technicians := []struct {
		name, phone, email, postal, address, location, travelType string
	}{
		{"Benjamin Loh", "92222221", "benjamin.tech@airserve.com", "520123", "1 Bishan Street 13", "1.3521,103.8198", "own_vehicle"},
		{"Wang Richie", "92222222", "richie.tech@airserve.com", "560123", "2 Ang Mo Kio Ave 10", "1.3621,103.8498", "rented_vehicle"},
		{"Timothy Neam", "92222223", "timothy.tech@airserve.com", "640123", "3 Jurong West Street 41", "1.3400,103.7100", "company_vehicle"},
	}
	specs := `["Daikin","Mitsubishi","Panasonic"]`
	for _, t := range technicians {
		_, err := pool.Exec(ctx,
			`INSERT INTO technicians
			 ("technicianName","technicianPhone","technicianEmail","technicianPassword",
			  "technicianPostalCode","technicianAddress","technicianLocation",
			  "technicianStatus","technicianTravelType",specializations,"isActive")
			 VALUES ($1,$2,$3,$4,$5,$6,$7,'1',$8,$9,TRUE)
			 ON CONFLICT ("technicianPhone") DO NOTHING`,
			t.name, t.phone, t.email, hash, t.postal, t.address, t.location, t.travelType, []byte(specs),
		)
		if err != nil {
			return fmt.Errorf("seeder: technician %s: %w", t.phone, err)
		}
	}
	log.Printf("seeder: technicians OK (%d)", len(technicians))
	return nil
}

func seedCustomers(ctx context.Context, pool *pgxpool.Pool, hash string) error {
	customers := []struct {
		name, email, phone, postal, address, location string
	}{
		{"Alice Tan", "alice.tan@email.com", "93333331", "560123", "Block 560 Ang Mo Kio Ave 10", "1.3621,103.8498"},
		{"Bob Lee", "bob.lee@email.com", "93333332", "460456", "Block 460 Bedok North Road", "1.3236,103.9273"},
		{"Charlie Wong", "charlie.wong@email.com", "93333333", "640789", "Block 640 Jurong West Street 61", "1.3400,103.7100"},
		{"Diana Lim", "diana.lim@email.com", "93333334", "521101", "Block 521 Bishan Street 11", "1.3521,103.8198"},
	}
	for _, c := range customers {
		_, err := pool.Exec(ctx,
			`INSERT INTO customers
			 ("customerName","customerEmail","customerPhone","customerPassword",
			  "customerPostalCode","customerAddress","customerLocation")
			 VALUES ($1,$2,$3,$4,$5,$6,$7)
			 ON CONFLICT ("customerEmail") DO NOTHING`,
			c.name, c.email, c.phone, hash, c.postal, c.address, c.location,
		)
		if err != nil {
			return fmt.Errorf("seeder: customer %s: %w", c.email, err)
		}
	}
	log.Printf("seeder: customers OK (%d)", len(customers))
	return nil
}

func seedCatalog(ctx context.Context, pool *pgxpool.Pool) error {
	entries := []struct{ brand, model string }{
		{"Daikin", "System 1"}, {"Daikin", "System 2"}, {"Daikin", "System 3"},
		{"Mitsubishi", "Starmex"}, {"Mitsubishi", "Kirigamine"}, {"Mitsubishi", "SRK Series"},
		{"Panasonic", "CS-S Series"}, {"Panasonic", "CS-Z Series"}, {"Panasonic", "CS-XU Series"},
		{"LG", "Artcool"}, {"LG", "DualCool"}, {"LG", "Standard Plus"},
		{"Samsung", "WindFree"}, {"Samsung", "Boracay"}, {"Samsung", "AR09"},
	}
	for _, e := range entries {
		_, err := pool.Exec(ctx,
			`INSERT INTO aircon_catalogs ("airconBrand","airconModel") VALUES ($1,$2)
			 ON CONFLICT ("airconBrand","airconModel") DO NOTHING`,
			e.brand, e.model,
		)
		if err != nil {
			return fmt.Errorf("seeder: catalog %s %s: %w", e.brand, e.model, err)
		}
	}
	log.Printf("seeder: aircon catalog OK (%d entries)", len(entries))
	return nil
}

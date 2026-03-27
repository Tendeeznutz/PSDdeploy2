// badges.go — leaderboard badge logic
package services

import "fmt"

// Badge represents a technician achievement.
type Badge struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Emoji string `json:"emoji"`
}

// TechnicianStats holds the raw numbers used for badge + score computation.
type TechnicianStats struct {
	TechnicianID   string
	TechnicianName string
	Rating         float64
	RatingCount    int64
	CompletedJobs  int64
}

// ComputeBadges returns the list of badges earned by a technician.
func ComputeBadges(stats TechnicianStats) []Badge {
	var badges []Badge

	if stats.CompletedJobs == 0 {
		badges = append(badges, Badge{"rookie", "Rookie", "🐣"})
	}
	if stats.CompletedJobs >= 100 {
		badges = append(badges, Badge{"cold_king", "Cold King", "❄️"})
	}
	if stats.CompletedJobs >= 50 {
		badges = append(badges, Badge{"freon_wizard", "Freon Wizard", "🧙"})
	}
	if stats.Rating >= 4.9 && stats.RatingCount >= 10 {
		badges = append(badges, Badge{"perfectionist", "The Perfectionist", "💎"})
	}
	if stats.CompletedJobs >= 10 && stats.Rating >= 4.5 {
		badges = append(badges, Badge{"reliable", "The Reliable One", "🛡️"})
	}
	if stats.CompletedJobs >= 200 {
		badges = append(badges, Badge{"legend", "AC Legend", "🏆"})
	}

	return badges
}

// ComputeScore computes a weighted leaderboard score (0–100).
// Weights: rating 40%, jobs 30%, engagement 30%.
func ComputeScore(stats TechnicianStats) float64 {
	ratingScore := (stats.Rating / 5.0) * 40.0

	// Jobs score: 30 pts for 100+ jobs, linear below.
	jobScore := float64(stats.CompletedJobs) / 100.0 * 30.0
	if jobScore > 30 {
		jobScore = 30
	}

	// Engagement score: having any reviews at all.
	engagementScore := 0.0
	if stats.RatingCount > 0 {
		engagementScore = float64(stats.RatingCount) / 50.0 * 30.0
		if engagementScore > 30 {
			engagementScore = 30
		}
	}

	return ratingScore + jobScore + engagementScore
}

// AirconHealthResult is returned by the Is-My-Aircon-Dying endpoint.
type AirconHealthResult struct {
	ProbabilityOfBreakdown int    `json:"probability_of_breakdown"`
	Verdict                string `json:"verdict"`
	Recommendation         string `json:"recommendation"`
	FunFact                string `json:"fun_fact"`
	Disclaimer             string `json:"disclaimer"`
}

// ComputeAirconHealth calculates a humorous-but-real aircon health score.
// Singapore standard: service every 3 months (≈90 days).
func ComputeAirconHealth(monthsSinceService int, units int) AirconHealthResult {
	if monthsSinceService < 0 {
		monthsSinceService = 0
	}
	if units < 1 {
		units = 1
	}

	// Base probability from service interval (90 days = 3 months = 0%).
	// Each additional month over 3 adds ~8% base probability, capped at 95%.
	overdue := monthsSinceService - 3
	if overdue < 0 {
		overdue = 0
	}
	probability := overdue * 8
	// Multiple units compound the risk slightly.
	probability += (units - 1) * 3
	if probability > 95 {
		probability = 95
	}
	if probability < 0 {
		probability = 0
	}

	hours := monthsSinceService * 24 * 30

	var verdict, recommendation string
	switch {
	case probability < 20:
		verdict = "Healthy"
		recommendation = "Your aircon is in fine shape. Book a routine service to keep it that way."
	case probability < 40:
		verdict = "Aging Gracefully"
		recommendation = "Consider booking a service soon. Prevention is cheaper than repair."
	case probability < 60:
		verdict = "Under the Weather"
		recommendation = "Your aircon is overdue. Book a service before it starts protesting loudly."
	case probability < 80:
		verdict = "Critically Overdue"
		recommendation = "Book a service immediately. Your aircon is sending distress signals."
	default:
		verdict = "Imminent Doom"
		recommendation = "Book a service yesterday. Seriously. Your aircon is writing its will."
	}

	return AirconHealthResult{
		ProbabilityOfBreakdown: probability,
		Verdict:                verdict,
		Recommendation:         recommendation,
		FunFact: fmt.Sprintf(
			"Your aircon has been running for approximately %d hours since its last service. "+
				"For context, a standard car engine would have covered ~%d km.",
			hours, hours*80/1000,
		),
		Disclaimer: "This assessment is for entertainment purposes. Also it's probably right.",
	}
}

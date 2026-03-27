// roast.go — auto-generates a humorous roast message for last-minute cancellers.
package services

import (
	"fmt"
	"math/rand"
	"time"
)

type RoastParams struct {
	CustomerName    string
	AppointmentTime time.Time
	TechnicianName  string
	PenaltyFee      float64
}

var roastTemplates = []string{
	"Hi %s, we noticed you cancelled your %s appointment with %s at %s. %s had already packed his toolkit, double-knotted his shoelaces, and mentally committed to fixing your aircon. He's fine. He says he's fine.%s",
	"Dear %s, cancelling a %s appointment at %s is certainly a choice. %s had been looking forward to this all day. The aircon hadn't. Both are disappointed.%s",
	"Hey %s, your %s appointment with %s was cancelled at %s. Fun fact: your aircon has been suffering silently this whole time. %s was its only hope. Not anymore.%s",
	"Hi %s, we have processed your cancellation for the %s appointment. %s will now spend that time contemplating the fleeting nature of scheduled commitments. Your aircon remains unwell.%s",
	"Dear %s, cancelling your %s appointment at %s — bold move. %s had already mentally rehearsed the entire job. The aircon will remember this.%s",
}

// GenerateRoastMessage creates a roast message for a last-minute cancellation.
func GenerateRoastMessage(p RoastParams) string {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	template := roastTemplates[rng.Intn(len(roastTemplates))]

	timeStr := p.AppointmentTime.Format("3:04 PM")
	dateStr := p.AppointmentTime.Format("02 Jan 2006")
	penaltyNote := ""
	if p.PenaltyFee > 0 {
		penaltyNote = fmt.Sprintf(" You also owe $%.2f.", p.PenaltyFee)
	}

	switch len(fmt.Sprintf(template, "")) {
	default:
		return fmt.Sprintf(template,
			p.CustomerName,
			dateStr,
			p.TechnicianName,
			timeStr,
			p.TechnicianName,
			penaltyNote,
		)
	}
}

// RoastSubject returns the email/message subject for the roast.
func RoastSubject() string {
	subjects := []string{
		"About your last-minute cancellation...",
		"We need to talk about this morning.",
		"Your aircon called. It's not happy.",
		"A note from your disappointed technician.",
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return subjects[rng.Intn(len(subjects))]
}

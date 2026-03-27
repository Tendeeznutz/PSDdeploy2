package services

// Thread-safety note:
//   GeoService caches a OneMap API token and its expiry.  Because multiple
//   goroutines (the reminder scheduler and concurrent HTTP handlers) may call
//   LookupPostal simultaneously, all reads and writes to the cached fields are
//   protected by a sync.RWMutex.
//   - RLock for reads when the token is still valid.
//   - Lock (exclusive) when refreshing the token.

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sync"
	"time"
)

// Coord represents a latitude/longitude coordinate pair.
type Coord struct {
	Lat float64
	Lon float64
}

// ParseCoord parses a "lat,lon" string as stored in the DB.
func ParseCoord(s string) (Coord, error) {
	var c Coord
	_, err := fmt.Sscanf(s, "%f,%f", &c.Lat, &c.Lon)
	return c, err
}

// HaversineKm computes the great-circle distance between two coordinates in km.
func HaversineKm(a, b Coord) float64 {
	const R = 6371.0
	dLat := (b.Lat - a.Lat) * math.Pi / 180
	dLon := (b.Lon - a.Lon) * math.Pi / 180
	la1 := a.Lat * math.Pi / 180
	la2 := b.Lat * math.Pi / 180
	x := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(la1)*math.Cos(la2)
	return R * 2 * math.Atan2(math.Sqrt(x), math.Sqrt(1-x))
}

// GeoService resolves Singapore postal codes to coordinates via OneMap API.
type GeoService struct {
	email    string
	password string

	mu       sync.RWMutex // guards token and tokenExp
	token    string
	tokenExp time.Time

	client *http.Client
}

// NewGeoService creates a GeoService. Credentials are optional — the service
// degrades gracefully to returning the Singapore centroid on any API failure.
func NewGeoService(email, password string) *GeoService {
	return &GeoService{
		email:    email,
		password: password,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

type oneMapSearchResp struct {
	Found   int `json:"found"`
	Results []struct {
		Latitude  string `json:"LATITUDE"`
		Longitude string `json:"LONGITUDE"`
	} `json:"results"`
}

// LookupPostal returns "lat,lon" for a Singapore 6-digit postal code.
// Falls back to the Singapore centroid on any error.
// Safe for concurrent use.
func (g *GeoService) LookupPostal(postalCode string) string {
	endpoint := fmt.Sprintf(
		"https://www.onemap.gov.sg/api/common/elastic/search?searchVal=%s&returnGeom=Y&getAddrDetails=N&pageNum=1",
		url.QueryEscape(postalCode),
	)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return "1.3521,103.8198"
	}

	// Attach bearer token if available (reduces throttling on authenticated tier).
	if tok := g.cachedToken(); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}

	resp, err := g.client.Do(req)
	if err != nil {
		return "1.3521,103.8198"
	}
	defer resp.Body.Close()

	var result oneMapSearchResp
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Found == 0 {
		return "1.3521,103.8198"
	}
	r := result.Results[0]
	if r.Latitude == "" || r.Longitude == "" {
		return "1.3521,103.8198"
	}
	return fmt.Sprintf("%s,%s", r.Latitude, r.Longitude)
}

// cachedToken returns the cached token if still valid, empty string otherwise.
func (g *GeoService) cachedToken() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if g.token != "" && time.Now().Before(g.tokenExp) {
		return g.token
	}
	return ""
}

// SetToken stores a new token and its expiry. Called externally (e.g., after
// authenticating against the OneMap auth endpoint).
func (g *GeoService) SetToken(token string, expiry time.Time) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.token = token
	g.tokenExp = expiry
}

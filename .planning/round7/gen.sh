#!/bin/bash
set -u
OUT=.planning/round7/specs
mkdir -p "$OUT"

gen() {
  local slug="$1"; local name="$2"; local desc="$3"
  local out="$OUT/$slug.json"
  curl -s -m 300 http://localhost:7133/generate-spec \
    -X POST -H "Content-Type: application/json" \
    -d "{\"business_name\":\"$name\",\"business_description\":\"$desc\"}" \
    -o "$out"
  local size
  size=$(wc -c < "$out" | tr -d ' ')
  if [ "$size" -lt 1000 ]; then
    echo "FAIL $slug ($size bytes): $(head -c 200 "$out")"
  else
    echo "OK   $slug ($size bytes)"
  fi
}

# A/B re-tests of round-6 lowest scorers (Gap 4+5 prompt rules)
gen hair-salon-v2    "Shear Luxe Salon"       "a neighborhood hair salon with stylists taking appointments for cuts, colors and treatments at different price points" &
gen house-cleaning-v2 "Sparkle Homes"         "a house cleaning service dispatching cleaners to customer homes for recurring weekly jobs at different addresses" &
gen landscaping-v2   "Evergreen Landscapes"   "a landscaping company dispatching crews to customer properties for mowing, pruning and seasonal work" &
gen music-school-v2  "Crescendo Academy"      "a music school where teachers give weekly lessons to students across piano, guitar and violin with different lesson packages and pricing" &

# Fresh verticals
gen dental-practice  "Bright Smile Dental"    "a dental practice with hygienists and dentists handling cleanings, fillings, root canals and orthodontics for patients across multiple visits" &
gen dog-walker       "Pawfect Walks"          "a dog walking service dispatching walkers to dog owners' homes for daily and recurring weekly walks across the city" &
gen accounting-firm  "Ledger & Co"            "a small accounting firm handling tax returns, bookkeeping and payroll for individual and business clients across the year" &
gen plumber          "Quick Pipe Plumbing"    "an on-call plumbing service dispatching plumbers to customer homes for emergency repairs and installations with parts inventory" &
gen bakery           "Daily Crumb Bakery"     "a bakery taking orders for custom cakes, pastries and bread with daily production schedules and pickup times" &
gen beauty-spa       "Lotus Wellness Spa"     "a beauty spa offering facial, massage and body treatments with packages, memberships and appointments for individual clients" &

wait
echo "ALL DONE"
ls -la "$OUT"/*.json | awk '{print $9, $5"B"}'

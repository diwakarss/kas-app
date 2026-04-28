#!/bin/bash
set -u
OUT=.planning/round6/specs
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

gen yoga-studio      "Zen Flow Yoga"          "a boutique yoga studio with group classes, private sessions and memberships" &
gen hair-salon       "Shear Luxe Salon"       "a neighborhood hair salon with stylists taking appointments for cuts, colors and treatments" &
gen bicycle-repair   "Spokes & Wheels"        "a bicycle repair shop servicing customer bikes with parts inventory and pickup scheduling" &
gen tattoo-parlor    "Ink District"           "a tattoo parlor where artists book appointments, take deposits and track designs per client" &
gen photo-studio     "Aperture Studios"       "a photography studio booking shoots, editing sessions and delivering final galleries to clients" &
gen vet-clinic       "Happy Paws Vet"         "a veterinary clinic tracking pets, visits, vaccinations and prescriptions across many pet owners" &
gen music-school     "Crescendo Academy"      "a music school with teachers giving weekly lessons to students across piano, guitar and violin" &
gen house-cleaning   "Sparkle Homes"          "a house cleaning service dispatching cleaners to customer homes with recurring weekly jobs" &
gen daycare          "Little Sprouts Daycare" "a childcare daycare tracking children, daily attendance, parents and enrollment plans" &
gen landscaping      "Evergreen Landscapes"   "a landscaping company dispatching crews to properties for mowing, pruning and seasonal work" &

wait
echo "ALL DONE"
ls -la "$OUT"/*.json | awk '{print $9, $5"B"}'

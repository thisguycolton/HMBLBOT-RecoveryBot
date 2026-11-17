class Ahoy::Store < Ahoy::DatabaseStore
end

# set to true for JavaScript tracking
Ahoy.api = false

# No analytics cookies: visits and visitors are told apart by a hash of the (masked) IP
# address and browser instead, so the site needs no cookie banner (see /privacy)
Ahoy.cookies = :none

# Keep only the network part of IP addresses (the last block is zeroed before saving)
Ahoy.mask_ips = true

# Rough location (city, region, country) for Admin > Analytics, looked up from the masked IP
Ahoy.geocode = true

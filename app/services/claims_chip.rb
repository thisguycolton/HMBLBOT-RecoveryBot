# Claims a chip someone was sent (ChipAward) for the account that opened its link, and says where
# to go: their Chips page on that chip, or nil when someone else already has it
class ClaimsChip
  def self.call(user, award)
    return "/recovery?chip=award:#{award.id}" if award.user_id == user.id
    return nil if award.claimed?

    award.claim!(user)
    "/recovery?chip=award:#{award.id}"
  end
end

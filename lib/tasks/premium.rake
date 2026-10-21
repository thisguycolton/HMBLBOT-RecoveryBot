namespace :premium do
  # Before turning on PREMIUM_ENFORCED: give every group that's already here a free year
  # (premium_until a year out; groups that already pay or are waived are left alone).
  # bin/rails premium:founding_year           -> lists them
  # bin/rails premium:founding_year APPLY=1   -> gives it
  desc "Give the groups already on RecoveryBot a free year of premium"
  task founding_year: :environment do
    apply = ENV["APPLY"].present?
    until_at = 1.year.from_now
    Group.where.not(plan: "waived").where(stripe_subscription_id: nil).find_each do |group|
      next if group.premium_until.present? && group.premium_until >= until_at

      puts "#{apply ? 'Gave' : 'Would give'} #{group.title} (#{group.slug}) premium until #{until_at.to_date}"
      group.update_column(:premium_until, until_at) if apply
    end
    puts "Run again with APPLY=1 to give it." unless apply
  end
end

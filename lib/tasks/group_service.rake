namespace :group_service do
  desc "Remind record keepers (and holders) of service terms that are nearly up; run daily"
  task remind: :environment do
    ServiceRotation.remind_all!
  end
end

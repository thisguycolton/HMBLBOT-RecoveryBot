module ApplicationCable
  class Connection < ActionCable::Connection::Base
    # whoever is signed in (Devise), or nobody: a visitor can still watch a public document
    identified_by :current_user

    def connect
      self.current_user = env["warden"]&.user
    end
  end
end

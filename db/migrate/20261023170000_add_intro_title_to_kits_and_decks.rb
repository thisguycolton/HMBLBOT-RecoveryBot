# What a HostDeck calls what comes before the script's first section ("Before we begin" when blank)
class AddIntroTitleToKitsAndDecks < ActiveRecord::Migration[8.0]
  def change
    add_column :hosting_kits, :intro_title, :string
    add_column :decks, :intro_title, :string
  end
end

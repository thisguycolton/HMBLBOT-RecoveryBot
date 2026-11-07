namespace :docs do
  desc "Add Docs drafts from db/docs/ that aren't in the database yet (never changes existing pages)"
  task import: :environment do
    added = DocsImport.run(log: ->(line) { puts line })
    puts "Added #{added[:sections]} sections and #{added[:pages]} pages."
  end
end

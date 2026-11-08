namespace :docs do
  desc "Add Docs drafts from db/docs/ that aren't in the database yet (never changes existing pages)"
  task import: :environment do
    added = DocsImport.run(log: ->(line) { puts line })
    puts "Added #{added[:sections]} sections and #{added[:pages]} pages."
  end

  desc "Like docs:import, and also update pages nobody has edited or reviewed yet with the newer text in db/docs/. " \
       "docs:refresh[reviewed] also updates reviewed pages whose words were never changed (old text kept in History, Reviewed cleared)"
  task :refresh, [:mode] => :environment do |_, args|
    mode = args[:mode] == "reviewed" ? :reviewed : true
    added = DocsImport.run(log: ->(line) { puts line }, refresh: mode)
    puts "Added #{added[:sections]} sections and #{added[:pages]} pages; refreshed #{added[:refreshed]} untouched pages."
  end
end

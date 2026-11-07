# Copies the Docs drafts in db/docs/ into the database: each folder is a section
# (db/docs/03-group-tools/_section.md) and each other .md file a page in it
# (db/docs/03-group-tools/05-group-chat.md). Files start with a front matter block:
#
#   ---
#   title: Group chat
#   summary: Talk with your group between meetings.
#   icon: MessagesSquare      (a Lucide icon name)
#   audience: everyone        (everyone | members | admins)
#   alias: about              (optional: also served at /about)
#   ---
#
# The number in a name sets the order and isn't part of the address. Only what doesn't exist
# yet is added (sections and pages are matched by address), so edits made in the docs editor are
# never overwritten. Run once by the CreateDocs migration; `bin/rails docs:import` for new drafts.
class DocsImport
  ROOT = Rails.root.join("db/docs")

  def self.run(root: ROOT, log: nil) = new(root, log).run

  def initialize(root, log)
    @root = Pathname(root)
    @log = log
  end

  def run
    added = { sections: 0, pages: 0 }
    Dir[@root.join("*")].select { |d| File.directory?(d) }.sort.each do |dir|
      position, slug = split(File.basename(dir))
      meta, body = read(File.join(dir, "_section.md"))
      section = DocSection.find_by(slug: slug)
      unless section
        section = DocSection.create!(slug: slug, title: meta["title"] || slug.titleize, summary: meta["summary"].presence || body.strip.presence,
                                     icon: meta["icon"], position: position)
        added[:sections] += 1
        @log&.call("Added section #{slug}")
      end

      Dir[File.join(dir, "*.md")].reject { |f| File.basename(f).start_with?("_") }.sort.each do |file|
        page_position, page_slug = split(File.basename(file, ".md"))
        next if section.pages.exists?(slug: page_slug)

        meta, body = read(file)
        next if meta["alias"].present? && DocPage.exists?(path_alias: meta["alias"])

        section.pages.create!(slug: page_slug, title: meta["title"] || page_slug.titleize, summary: meta["summary"], icon: meta["icon"],
                              audience: meta["audience"].presence || "everyone", path_alias: meta["alias"], body: body.strip + "\n",
                              position: page_position, status: "published")
        added[:pages] += 1
        @log&.call("Added page #{slug}/#{page_slug}")
      end
    end
    added
  end

  private

  # "03-group-tools" -> [3, "group-tools"]
  def split(name)
    m = name.match(/\A(\d+)-(.+)\z/)
    m ? [m[1].to_i, m[2]] : [0, name]
  end

  def read(file)
    return [{}, ""] unless File.exist?(file)

    text = File.read(file)
    if (m = text.match(/\A---\s*\n(.*?)\n---\s*\n?/m))
      [YAML.safe_load(m[1]) || {}, m.post_match]
    else
      [{}, text]
    end
  end
end

# db/migrate/20250820_backfill_book_and_chapter_slugs.rb
class BackfillBookAndChapterSlugs < ActiveRecord::Migration[7.1]
  def up
    Book.reset_column_information
    Chapter.reset_column_information

    Book.find_each do |b|
      b.update_columns(
        slug: (b.slug.presence || b.title.to_s.parameterize.presence || "book-#{b.id}"),
        edition: b.edition.presence || "1e"
      )
    end

    Chapter.where(slug: nil).find_each do |ch|
      bk = ch.book
      idx = ch.number || ch.id
      ch.update_columns(
        index: ch.index || idx,
        slug:  ch.slug  || "#{bk.slug}-ch#{idx.to_i.to_s.rjust(2,'0')}"
      )
    end
  end

  def down
    # no-op (safe to leave data)
  end
end

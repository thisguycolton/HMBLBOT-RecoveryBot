# What someone who can't open a members-only book (Book#locked_for?) is told: that it's only for
# members of groups that read it, and how to get in. Sign in first if they haven't; otherwise
# join one of the approved groups that list it in their literature (named here, since their
# pages are open to everyone), or have their own group add it under Literature.
# The reader shows it as a page (pages/members_only); the API sends it with a 403.
module MembersOnly
  GROUPS_MAX = 8

  def self.json(book, user)
    groups = book.reading_groups.limit(GROUPS_MAX + 1).to_a
    {
      locked: true,
      members_only: true,
      signed_in: user.present?,
      title: book.title,
      book_slug: book.slug,
      error: "#{book.title} is only for members of groups that read it.",
      groups: groups.first(GROUPS_MAX).map { |g| { title: g.title, slug: g.slug, url: "/groups/#{g.slug}" } },
      more_groups: groups.size > GROUPS_MAX,
    }
  end
end

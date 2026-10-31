# A message in a group's chat channel (ChatChannel): Markdown like a note, edited or deleted
# by its writer (the group's admins delete any). Its @ mentions notify people (Mentionable).
# Anyone in the channel puts emoji on it (ChatReaction) and replies to it, which tells its writer.
# Whoever manages the channel pins it there; the group's admins move it (and the replies under
# it) to another channel when it went in the wrong one. It can carry pictures and files, seen
# only by people in its channel (Api::GroupChatMessagesController#file), and shows a card for
# its first link (LinkPreview, read in the background by ChatLinkPreviewJob). Its writer can also
# attach the group's documents (document_ids): each reader sees the ones they may open.
class ChatMessage < ApplicationRecord
  moderates_language :body
  include Mentionable

  BODY_MAX = 4000
  # How much of the message a reply shows it answered
  QUOTE_MAX = 160
  FILES_MAX = 6
  DOCUMENTS_MAX = 6
  IMAGE_MAX = 10.megabytes
  FILE_MAX = 20.megabytes
  # What can be attached, by extension, and the type it's served as. Pictures show in the
  # message; PDFs open in the browser; the rest download.
  FILE_TYPES = {
    "png" => "image/png", "jpg" => "image/jpeg", "jpeg" => "image/jpeg", "webp" => "image/webp", "gif" => "image/gif",
    "pdf" => "application/pdf",
    "doc" => "application/msword",
    "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls" => "application/vnd.ms-excel",
    "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt" => "application/vnd.ms-powerpoint",
    "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt" => "text/plain", "csv" => "text/csv",
  }.freeze
  INLINE_TYPES = %w[image/png image/jpeg image/webp image/gif application/pdf].freeze
  # The first web address in it (bare or in a [label](link)), as LinkCard.firstLink finds it
  LINK = %r{https?://[^\s<>()\[\]]+[^\s<>()\[\].,;:!?'"]}i

  belongs_to :chat_channel
  belongs_to :user
  has_many :reactions, -> { order(:id) }, class_name: "ChatReaction", dependent: :delete_all
  # What it answers; the id stays when that one is deleted, so the reply can say so
  belongs_to :reply_to, class_name: "ChatMessage", optional: true
  has_many :replies, class_name: "ChatMessage", foreign_key: :reply_to_id, inverse_of: :reply_to
  belongs_to :pinned_by, class_name: "User", optional: true
  has_many_attached :files
  has_one_attached :link_image

  before_validation { self.body = body.to_s.gsub("\r\n", "\n").strip }
  validates :body, length: { maximum: BODY_MAX }
  before_validation { self.document_ids = Array(document_ids).map(&:to_i).uniq.reject(&:zero?) }
  validate { errors.add(:body, "can't be blank") if body.blank? && !files.attached? && document_ids.empty? }
  validate { errors.add(:document_ids, "can be up to #{DOCUMENTS_MAX}") if document_ids.size > DOCUMENTS_MAX }
  validate(on: :create) { (problem = self.class.upload_problem(files.map(&:blob))) && errors.add(:files, problem) }
  validate(on: :create) { errors.add(:reply_to, "isn't in this channel") if reply_to && reply_to.chat_channel_id != chat_channel_id }

  after_create_commit { chat_channel.update_column(:last_message_at, created_at) }
  after_create_commit { broadcast("created") }
  after_update_commit { broadcast("updated") }
  after_destroy_commit { broadcast("deleted") }

  def group = chat_channel.group
  def self.file_type_for(name) = FILE_TYPES[File.extname(name.to_s).delete(".").downcase]
  def self.first_link(text) = text.to_s[LINK]

  # Why these uploads (or blobs) can't go on a message, or nil
  def self.upload_problem(files)
    return "A message can have up to #{FILES_MAX} files." if files.size > FILES_MAX

    files.each do |f|
      name = f.respond_to?(:original_filename) ? f.original_filename : f.filename.to_s
      size = f.respond_to?(:byte_size) ? f.byte_size : f.size
      type = file_type_for(name)
      return "#{name} can't be sent here: pictures, PDFs, Word, Excel, PowerPoint, text and CSV files can." unless type
      return "Pictures need to be under 10 MB each." if type.start_with?("image/") && size > IMAGE_MAX
      return "Files need to be under 20 MB each." if size > FILE_MAX
    end
    nil
  end

  # A line about it for notifications and reply quotes: its words, or what it carries
  def summary(max)
    return body.gsub(/\s+/, " ").truncate(max) if body.present?
    return "📄 #{document_ids.size == 1 ? 'A group document' : "#{document_ids.size} group documents"}" unless files.attached?

    n = files.size
    pictures = files.all? { |f| f.content_type.to_s.start_with?("image/") }
    pictures ? "📷 #{n == 1 ? 'A picture' : "#{n} pictures"}" : "📎 #{n == 1 ? files.first.filename : "#{n} files"}"
  end
  def path = "/groups/#{group.slug}/messages/#{chat_channel_id}?m=#{id}"

  # Saves it, then tells who it newly @ mentions (if they're in the channel), and, when it's a
  # new reply, whoever wrote the message it answers (unless they were mentioned anyway)
  def save_and_mention!(author)
    channel = chat_channel
    replying = new_record? && reply_to
    people = take_mentions(body, author: author, groups: [group],
                                 everyone: group.manageable_by?(author) && channel.readers,
                                 can_see: ->(u) { channel.readable_by?(u) })
    save!
    ChatLinkPreviewJob.perform_later(self) if link_outdated?
    tell_mentioned(people, kind: "mention.chat", body: summary(200), url: path, from: author,
                           title: ->(handle) { "#{author.display_name} mentioned #{handle ? "@#{handle}" : 'you'} in ##{channel.name}" })
    tell_replied_to(author) if replying && people.keys.none? { |u| u.id == reply_to.user_id }
  end

  # What the viewer may do to it, worked out once for a page of them (ChatMessage.permissions)
  def self.permissions(channel, viewer)
    admin = channel.group.manageable_by?(viewer)
    { admin: admin, pin: admin || channel.manageable_by?(viewer) }
  end

  def removable_by?(viewer, can = ChatMessage.permissions(chat_channel, viewer)) = user_id == viewer&.id || can[:admin]

  def pinned? = pinned_at.present?

  # Pins it in its channel, or takes the pin off (without counting as an edit; the caller tells
  # the channel)
  def pin!(by, on)
    update_columns(pinned_at: on ? Time.current : nil, pinned_by_id: on ? by.id : nil)
  end

  # Moves it, and every reply under it, to `channel` (in the same group): they come out of the
  # one they were in, live, and go into that one as if they'd been changed there, in the order
  # they were written. Mentions and emoji go along; nobody is told again. Gives their ids.
  def move_to!(channel)
    from = chat_channel
    ids = thread_ids
    ChatMessage.transaction do
      ChatMessage.where(id: ids).update_all(chat_channel_id: channel.id, moved_from_channel_id: from.id, moved_at: Time.current, updated_at: Time.current)
      [from, channel].each { |c| c.update_column(:last_message_at, c.messages.maximum(:created_at)) }
    end
    ids.each do |id|
      ActionCable.server.broadcast(from.stream, { type: "deleted", channel_id: from.id, id: id })
      ActionCable.server.broadcast(channel.stream, { type: "updated", channel_id: channel.id, id: id })
    end
    reload
    ids
  end

  # It and the replies under it (and theirs), in its channel
  def thread_ids
    ids = [id]
    level = [id]
    while (level = ChatMessage.where(chat_channel_id: chat_channel_id, reply_to_id: level).where.not(id: ids).pluck(:id)).any?
      ids.concat(level)
    end
    ids
  end

  # For a list of them: preload `reply_to: :user, reactions: :user` and pass `can`
  def as_api_json(viewer:, can: ChatMessage.permissions(chat_channel, viewer))
    {
      id: id, channel_id: chat_channel_id, body: body, mentions: mentions,
      author: user.as_person_json, created_at: created_at.iso8601, edited: edited_at.present?,
      mine: user_id == viewer&.id, mentions_me: mentions?(viewer), can_remove: removable_by?(viewer, can),
      # From someone the viewer blocked: shown folded up, opened only if they ask
      blocked: !!viewer&.blocked?(user),
      reactions: reactions_json(viewer),
      reply_to: reply_to_json(viewer),
      pinned: pinned? ? { at: pinned_at.iso8601, by: pinned_by&.display_name } : nil,
      moved_from: moved_from_channel_id && { id: moved_from_channel_id, name: ChatChannel.where(id: moved_from_channel_id).pick(:name) },
      can_pin: can[:pin], can_move: can[:admin],
      files: files_json, link: link_json, documents: documents_json(viewer),
    }
  end

  # The group documents on it: the ones the viewer may open with their title and file, the rest
  # only as there (GroupDocument.visible_to), and none that were deleted
  def documents_json(viewer)
    return [] if document_ids.empty?

    all = group.documents.where(id: document_ids).with_attached_file.index_by(&:id)
    open = GroupDocument.visible_to(group, viewer).where(id: all.keys).pluck(:id)
    document_ids.filter_map do |doc_id|
      doc = all[doc_id] or next
      next { id: doc_id, hidden: true } unless open.include?(doc_id)

      { id: doc_id, title: doc.title, kind: doc.kind, url: "/groups/#{group.slug}/conscience/documents/#{doc_id}",
        file: (doc.file.attached? ? { name: doc.file.filename.to_s, type: doc.served_type, size: doc.file.byte_size } : nil) }
    end
  end

  # Its pictures and files, each through Api::GroupChatMessagesController#file (preload
  # `files_attachments: :blob` for a list of them)
  def files_json
    files.attachments.map do |a|
      type = self.class.file_type_for(a.filename)
      { id: a.id, name: a.filename.to_s, type: type, size: a.byte_size, image: type.to_s.start_with?("image/"),
        width: a.metadata["width"], height: a.metadata["height"],
        url: "/api/groups/#{group.slug}/chat_messages/#{id}/files/#{a.id}" }
    end
  end

  # The card for its first link, unless there was nothing to show or its writer took it off
  def link_json
    return if link_preview.blank? || link_preview["title"].blank? || link_preview["hidden"]

    image = (Rails.application.routes.url_helpers.rails_storage_proxy_path(link_image, only_path: true) if link_image.attached?)
    link_preview.slice("url", "title", "description", "site_name").merge("image_url" => image)
  end

  # Whether the card is for some other link than its first one now
  def link_outdated? = self.class.first_link(body) != link_preview&.dig("url")

  # Reads the card for its first link (LinkPreview, which may take a few seconds), copies the
  # picture here so readers never load it from the other site, and tells the channel
  def take_link_preview!
    url = self.class.first_link(body)
    preview = (LinkPreview.fetch(url) if url)
    image = preview && preview[:image_url] && LinkPreview.image(preview[:image_url])
    link_image.purge_later if link_image.attached?
    link_image.attach(image) if image
    update_column(:link_preview, url && (preview&.slice(:url, :title, :description, :site_name)&.stringify_keys || { "url" => url }))
    broadcast("updated")
  end

  # Its writer takes the card off (it stays off for that link)
  def hide_link!
    update_column(:link_preview, (link_preview || {}).merge("hidden" => true))
    broadcast("updated")
  end

  # The message it answers, cut short: who wrote it and its start (or that it's gone, or in
  # another channel now, after a move)
  def reply_to_json(viewer)
    return nil unless reply_to_id
    return { id: reply_to_id, gone: true } unless reply_to

    { id: reply_to.id, channel_id: reply_to.chat_channel_id, author: { id: reply_to.user_id, name: reply_to.user.display_name },
      excerpt: reply_to.summary(QUOTE_MAX), blocked: !!viewer&.blocked?(reply_to.user) }
  end

  # Each emoji on it, in the order they first went on, with how many, whether the viewer's is
  # one, and who (leaving out the names of people the viewer blocked; preload
  # `reactions: :user` for a list of messages)
  def reactions_json(viewer)
    blocked = viewer ? viewer.blocked_ids : []
    reactions.group_by(&:emoji).map do |emoji, list|
      { emoji: emoji, count: list.size, mine: list.any? { |r| r.user_id == viewer&.id },
        names: list.reject { |r| blocked.include?(r.user_id) }.map { |r| r.user_id == viewer&.id ? "You" : r.user.display_name } }
    end
  end

  # Everyone listening hears which message changed; they fetch it, since the production cable
  # (Postgres) can't carry a long one
  def broadcast(type)
    ActionCable.server.broadcast("chat:#{chat_channel_id}", { type: type, channel_id: chat_channel_id, id: id, user_id: user_id })
  end

  private

  def tell_replied_to(author)
    person = reply_to.user
    return if person.id == author.id || !chat_channel.readable_by?(person)

    Notification.deliver(person, kind: "reply.chat", title: "#{author.display_name} replied to you in ##{chat_channel.name}",
                                 body: summary(200), url: path, from: author)
  end
end

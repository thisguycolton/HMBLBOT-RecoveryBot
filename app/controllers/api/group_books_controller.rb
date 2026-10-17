# The library books a group has approved for its meetings (group admins)
class Api::GroupBooksController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_manager

  # POST /api/groups/:slug/books { book_slug, note }
  def create
    book = Book.visible_to(current_user).find_by!(slug: params[:book_slug])
    group_book = @group.group_books.find_or_initialize_by(book: book)
    group_book.note = params[:note].to_s.strip.presence
    group_book.save ? head(:created) : render_errors(group_book)
  end

  # PATCH /api/groups/:slug/books/:id { note }
  def update
    group_book = @group.group_books.find(params[:id])
    group_book.update(note: params[:note].to_s.strip.presence) ? head(:no_content) : render_errors(group_book)
  end

  # DELETE /api/groups/:slug/books/:id
  def destroy
    @group.group_books.find(params[:id]).destroy!
    head :no_content
  end
end

class ChaptersController < ApplicationController
  before_action :set_chapter, only: %i[ show edit update destroy ]

  # GET /chapters or /chapters.json
  def index
    @book = Book.find(params[:book_id])
    @chapters = @book.chapters
    
  end

  # GET /chapters/1 or /chapters/1.json
  def show
  end

  # GET /chapters/new
  def new
    @book = Book.find(params[:book_id])
    @chapter = Chapter.new
  end

  # GET /chapters/1/edit
  def edit
    @book = Book.find(params[:book_id])

  end

  # POST /chapters or /chapters.json
  def create
    @chapter = Chapter.new(chapter_params)

    respond_to do |format|
      if @chapter.save
        format.html { redirect_to book_chapter_url(@chapter.book, @chapter), notice: "Chapter was successfully created." }
        format.json { render :show, status: :created, location: @chapter }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @chapter.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /chapters/1 or /chapters/1.json
  def update
    respond_to do |format|
      if @chapter.update(chapter_params)
        format.html { redirect_to book_chapter_url(@chapter.book, @chapter), notice: "Chapter was successfully updated." }
        format.json { render :show, status: :ok, location: @chapter }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @chapter.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /chapters/1 or /chapters/1.json
  def destroy
    @chapter.destroy

    respond_to do |format|
      format.html { redirect_to chapters_url, notice: "Chapter was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_chapter
      @book = Book.find(params[:book_id])
      @chapter = @book.chapters.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def chapter_params
      params.require(:chapter).permit(:book_id, :title, :number, :content)
    end
end

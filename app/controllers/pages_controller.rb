class PagesController < ApplicationController
  before_action :set_page, only: %i[ edit update destroy ]
  layout "reader", only: %i[ topicificator, library ]

  # GET /pages or /pages.json
  #
  def library


  end
  def index
    @pages = Page.all
  end

  def game

  end
  def topicificator

  end

  # GET /pages/1 or /pages/1.json
  def show
    @book = Book.find(params[:book_id])
    @page_number = params[:page_number]
    @page = @book.pages.where(page_number: @page_number.to_s)

    @prev_page_number = params[:page_number].to_i - 1
    @prev_page = @book.pages.where(page_number: @prev_page_number.to_s)

    if @page
      # Render the page content
    else
      # Handle when the page is not found (404 or other logic)
    end
  end

  # GET /pages/new
  def new
    @page = Page.new
  end

  # GET /pages/1/edit
  def edit
  end

  # POST /pages or /pages.json
  def create
    @page = Page.new(page_params)

    respond_to do |format|
      if @page.save
        format.html { redirect_to page_url(@page), notice: "Page was successfully created." }
        format.json { render :show, status: :created, location: @page }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @page.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /pages/1 or /pages/1.json
  def update
    respond_to do |format|
      if @page.update(page_params)
        format.html { redirect_to page_url(@page), notice: "Page was successfully updated." }
        format.json { render :show, status: :ok, location: @page }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @page.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /pages/1 or /pages/1.json
  def destroy
    @page.destroy

    respond_to do |format|
      format.html { redirect_to pages_url, notice: "Page was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_page
      @page = Page.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def page_params
      params.require(:page).permit(:book_id, :content, :page_number)
    end
end

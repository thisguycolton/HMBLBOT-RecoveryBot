Rails.application.routes.draw do
  resources :topic_sets
  resources :hostificators do
    member do
      get :results
      post :vote
    end
  end
  resources :court_verifications, only: :new

  resources :tags

  resources :hostificators, only: [:new, :create, :show] do
    post :vote, on: :member
  end

  get "/topicificator", to: "pages#topicificator"
  get "/library(/*path)", to: "pages#library"

  get "game_server/getting_started"
  get "game_server/plugin_faq"


  namespace :api do
            resources :court_verifications, only: :create

  resources :highlights, only: [:index, :create, :destroy] do
    collection { post :share }
  end

  resources :books, param: :slug do
    collection do
      post :import_json         # => POST /api/books/import_json
    end

    member do
      get :export               # => GET /api/books/:slug/export
      get :manage_chapters
    end

    resources :chapters, param: :slug, only: [:index, :show, :update, :create, :destroy] do
      collection do
        post :merge
        post :reorder
      end
    end

  end


  resources :topic_sets, only: [:index]

    namespace :v1 do
      # Quest Players
      resources :quest_players, only: [:create, :show, :index, :update, :destroy] do
        resources :quest_sessions, only: [:index, :create, :destroy]
        collection do
          post :create_by_screen_name
        end
      end

      # Quest Sessions
      resources :quest_sessions, only: [:create, :show, :index, :update, :destroy] do
        resources :quest_inventory, only: [:show, :update], singleton: true
        resources :log_entries, only: [:create], controller: "quest_log_entries"
        resources :stories, only: [:index, :create], controller: "quest_stories"
        member do
          get :journey
          get :log
          post :complete
        end
      end

      # ACID QUEST topic draws and sharing modes (read the Topicificator library)
      resources :sharing_modes, only: [:index]
      get "quest_topics/draw", to: "quest_topics#draw"
      get "quest_topics/categories", to: "quest_topics#categories"
      get "quest_topics/:id", to: "quest_topics#show", constraints: { id: /\d+/ }

      # Join Session by Code
      post '/join_session', to: 'quest_sessions#join_by_code'

      # Health Check
      get '/health', to: 'health#check'
    end
  end
namespace :api do
  # explicit collection endpoints
  get 'topics/by_number', to: 'topics#by_number'
  get 'topics/random',    to: 'topics#random'

  # only allow numeric IDs for :show so 'by_number' won't match here
  resources :topics, only: [:index, :show], constraints: { id: /\d+/ }

  resources :topic_sets, only: [:index, :show]
end
  resources :topic_categories
  resources :service_readings
  resources :user_active_groups, only: %i[create update]
  resources :icons, only: [:index, :show]
  get 'game/game'
  get 'game/world', to: 'game#world' # generated-world overview for tuning (?seed=N)
  get 'topics/by_category', to: 'topics#by_category'
  resources :groups do
    resources :meetings
  end
  get 'host_helper/scratchpaper'
  # config/routes.rb
  get "/books/:book_slug/chapters/:chapter_slug", to: "pages#reader"
  resources :polls do
    resources :options
  end
  mount ActionCable.server => '/cable'
  mount AhoyCaptain::Engine => '/ahoy_captain'

  resources :books, param: :slug, only: [] do
    resources :chapters, param: :slug, only: [:index, :show, :edit]
  end

  resources :topics
  devise_for :users

  namespace :admin_panel do
    resources :users, only: [:index] do
      member do
        patch :confirm
      end
    end
    # React app; every path below it routes on the client
    get "topicificator(/*path)", to: "topicificator#show", as: :topicificator
    resources :court_verifications, only: :index do
      get :print, on: :collection
    end
  end

  # JSON behind the Topicificator admin (admins only)
  namespace :api do
    namespace :admin do
      resource :meta, only: :show, controller: "meta"
      resources :topics, only: %i[index show create update destroy] do
        member do
          put "prompts/:mode_key", action: :save_prompt
          delete "prompts/:mode_key", action: :remove_prompt
        end
      end
      resources :topic_sets, only: %i[create update destroy]
      resources :topic_categories, only: %i[create update destroy]
      resources :court_verifications, only: :index do
        post :send_bundle, on: :collection
      end
    end
  end
  resources :readings do
    get :mine, on: :collection
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
   root "pages#home"
end
